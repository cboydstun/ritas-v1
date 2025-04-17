"use client";

import { useState } from "react";
import { IEmailTemplate } from "@/models/email-template";

interface EmailPreviewProps {
  template: IEmailTemplate;
  variables: Record<string, string>;
  onVariableChange: (variables: Record<string, string>) => void;
  onClose: () => void;
  onSendTest: (
    templateId: string,
    email: string,
    variables: Record<string, string>,
  ) => Promise<void>;
}

export default function EmailPreview({
  template,
  variables,
  onVariableChange,
  onClose,
  onSendTest,
}: EmailPreviewProps) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);

  // Handle variable change
  const handleVariableChange = (name: string, value: string) => {
    const newVariables = { ...variables, [name]: value };
    onVariableChange(newVariables);
  };

  // Generate preview
  const generatePreview = async () => {
    try {
      setPreviewLoading(true);
      setPreviewError(null);

      const response = await fetch("/api/admin/email-templates/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId: template._id,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error generating preview: ${response.statusText}`);
      }

      const data = await response.json();
      setPreviewHtml(data.body);
      setPreviewSubject(data.subject);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error generating preview:", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle send test email
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!testEmail) {
      setPreviewError("Email address is required");
      return;
    }

    try {
      setSendingTest(true);
      setPreviewError(null);

      await onSendTest(template._id?.toString() || "", testEmail, variables);

      // Reset form
      setTestEmail("");
      setShowTestForm(false);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error sending test email:", err);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Preview: {template.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Error message */}
          {previewError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {previewError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Variables panel */}
            <div className="md:col-span-1">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">
                  Template Variables
                </h3>

                {template.variables.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This template has no variables.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {template.variables.map((variable) => (
                      <div key={variable.name}>
                        <label
                          htmlFor={`var-${variable.name}`}
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          {variable.name}
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            ({variable.description})
                          </span>
                        </label>
                        <input
                          type="text"
                          id={`var-${variable.name}`}
                          value={variables[variable.name] || ""}
                          onChange={(e) =>
                            handleVariableChange(variable.name, e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-800 dark:text-white text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={generatePreview}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    disabled={previewLoading}
                  >
                    {previewLoading ? "Generating..." : "Generate Preview"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTestForm(!showTestForm)}
                    className="w-full px-4 py-2 bg-teal text-white rounded hover:bg-teal-600 transition-colors"
                  >
                    {showTestForm ? "Hide Test Form" : "Send Test Email"}
                  </button>
                </div>

                {/* Test email form */}
                {showTestForm && (
                  <form onSubmit={handleSendTest} className="mt-4">
                    <div className="mb-3">
                      <label
                        htmlFor="testEmail"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        id="testEmail"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-800 dark:text-white text-sm"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                      disabled={sendingTest}
                    >
                      {sendingTest ? "Sending..." : "Send Test"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Preview panel */}
            <div className="md:col-span-2">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Subject line */}
                {previewSubject && (
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Subject: {previewSubject}
                    </h4>
                  </div>
                )}

                {/* Email body */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                  {previewLoading ? (
                    <div className="flex justify-center items-center h-64">
                      <p className="text-gray-500 dark:text-gray-400">
                        Generating preview...
                      </p>
                    </div>
                  ) : previewHtml ? (
                    <div
                      className="email-preview"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : (
                    <div className="flex justify-center items-center h-64">
                      <p className="text-gray-500 dark:text-gray-400">
                        Click `&quot;`Generate Preview`&quot;` to see the email with your
                        variables.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
