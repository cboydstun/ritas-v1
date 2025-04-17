"use client";

import { useState, useEffect } from "react";
import { IEmailTemplate, IVariable } from "@/models/email-template";

interface EmailTemplateFormProps {
  template: IEmailTemplate | null;
  onClose: () => void;
  onSubmit: () => void;
}

export default function EmailTemplateForm({
  template,
  onClose,
  onSubmit,
}: EmailTemplateFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [variables, setVariables] = useState<IVariable[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newVariable, setNewVariable] = useState<IVariable>({
    name: "",
    description: "",
    defaultValue: "",
  });

  // Initialize form with template data if editing
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setSubject(template.subject);
      setBody(template.body);
      setVariables(template.variables || []);
      setIsDefault(template.isDefault || false);
    }
  }, [template]);

  // Add a new variable to the list
  const addVariable = () => {
    if (!newVariable.name || !newVariable.description) {
      setError("Variable name and description are required");
      return;
    }

    // Check if variable name already exists
    if (variables.some((v) => v.name === newVariable.name)) {
      setError(`Variable '${newVariable.name}' already exists`);
      return;
    }

    setVariables([...variables, { ...newVariable }]);
    setNewVariable({
      name: "",
      description: "",
      defaultValue: "",
    });
    setError(null);
  };

  // Remove a variable from the list
  const removeVariable = (index: number) => {
    const newVariables = [...variables];
    newVariables.splice(index, 1);
    setVariables(newVariables);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Validate form
      if (!name || !subject || !body) {
        setError("Name, subject, and body are required");
        return;
      }

      const templateData = {
        name,
        description,
        subject,
        body,
        variables,
        isDefault,
      };

      // Determine if we're creating or updating
      const url = template
        ? `/api/admin/email-templates/${template._id}`
        : "/api/admin/email-templates";

      const method = template ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `Error ${method === "POST" ? "creating" : "updating"} template`,
        );
      }

      // Call the onSubmit callback to refresh the template list
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error saving email template:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              {template ? "Edit Email Template" : "Create Email Template"}
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
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Template Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Email Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
            </div>

            <div className="mb-6">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Description
              </label>
              <input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="body"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email Body (HTML) *
              </label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-700 dark:text-white font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use &#123;&#123;variableName&#125;&#125; syntax to include
                variables in your template.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 text-teal focus:ring-teal border-gray-300 rounded"
                />
                <label
                  htmlFor="isDefault"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Set as default template
                </label>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">
                Template Variables
              </h3>

              {/* Variable list */}
              {variables.length > 0 && (
                <div className="mb-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          Name
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          Description
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          Default Value
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {variables.map((variable, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {variable.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {variable.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {variable.defaultValue || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              type="button"
                              onClick={() => removeVariable(index)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add new variable */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-800 dark:text-white mb-3">
                  Add Variable
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="varName"
                      className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Name *
                    </label>
                    <input
                      type="text"
                      id="varName"
                      value={newVariable.name}
                      onChange={(e) =>
                        setNewVariable({ ...newVariable, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-800 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="varDescription"
                      className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Description *
                    </label>
                    <input
                      type="text"
                      id="varDescription"
                      value={newVariable.description}
                      onChange={(e) =>
                        setNewVariable({
                          ...newVariable,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-800 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="varDefaultValue"
                      className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Default Value
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        id="varDefaultValue"
                        value={newVariable.defaultValue}
                        onChange={(e) =>
                          setNewVariable({
                            ...newVariable,
                            defaultValue: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-l-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-800 dark:text-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={addVariable}
                        className="px-4 py-2 bg-teal text-white rounded-r-md hover:bg-teal-600 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal text-white rounded-md hover:bg-teal-600 transition-colors"
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : template
                    ? "Update Template"
                    : "Create Template"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
