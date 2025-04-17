"use client";

import { useState, useEffect } from "react";
import { IEmailTemplate } from "@/models/email-template";
import EmailTemplateForm from "./EmailTemplateForm";
import EmailPreview from "./EmailPreview";

export default function EmailTemplateList() {
  const [templates, setTemplates] = useState<IEmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<IEmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<IEmailTemplate | null>(null);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch templates on component mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  // Fetch all email templates
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch("/api/admin/email-templates");
      
      if (!response.ok) {
        throw new Error(`Error fetching templates: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching email templates:", err);
    } finally {
      setLoading(false);
    }
  };

  // Delete a template
  const deleteTemplate = async (id: string) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/admin/email-templates/${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting template: ${response.statusText}`);
      }
      
      // Remove the template from the list
      setTemplates(templates.filter(template => template._id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error deleting email template:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle template form submission (create or update)
  const handleFormSubmit = async () => {
    await fetchTemplates();
    setIsCreating(false);
    setEditingTemplate(null);
  };

  // Handle preview
  const handlePreview = (template: IEmailTemplate) => {
    // Initialize preview variables with default values
    const initialVariables: Record<string, string> = {};
    template.variables.forEach(variable => {
      initialVariables[variable.name] = variable.defaultValue || "";
    });
    
    setPreviewTemplate(template);
    setPreviewVariables(initialVariables);
    setShowPreview(true);
  };

  // Handle sending test email
  const handleSendTest = async (templateId: string, email: string, variables: Record<string, string>) => {
    try {
      setLoading(true);
      
      const response = await fetch("/api/admin/email-templates/send-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId,
          to: email,
          variables,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error sending test email: ${response.statusText}`);
      }
      
      alert("Test email sent successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error sending test email:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          Email Templates
        </h2>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-teal text-white rounded hover:bg-teal-600 transition-colors"
        >
          Create Template
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && <div className="text-center py-4">Loading...</div>}

      {/* Template list */}
      {!loading && templates.length === 0 && (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            No email templates found. Create your first template to get started.
          </p>
        </div>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div
            key={template._id?.toString()}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {template.name}
              </h3>
              {template.isDefault && (
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                  Default
                </span>
              )}
            </div>
            
            {template.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {template.description}
              </p>
            )}
            
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              <strong>Subject:</strong> {template.subject}
            </div>
            
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              <strong>Variables:</strong>{" "}
              {template.variables.length > 0
                ? template.variables.map(v => v.name).join(", ")
                : "None"}
            </div>
            
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => handlePreview(template)}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
              >
                Preview
              </button>
              <button
                onClick={() => setEditingTemplate(template)}
                className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => setDeleteConfirmId(template._id?.toString() || "")}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>

            {/* Delete confirmation */}
            {deleteConfirmId === template._id?.toString() && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                  Are you sure you want to delete this template?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteTemplate(template._id?.toString() || "")}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create/Edit form modal */}
      {(isCreating || editingTemplate) && (
        <EmailTemplateForm
          template={editingTemplate}
          onClose={() => {
            setIsCreating(false);
            setEditingTemplate(null);
          }}
          onSubmit={handleFormSubmit}
        />
      )}

      {/* Preview modal */}
      {showPreview && previewTemplate && (
        <EmailPreview
          template={previewTemplate}
          variables={previewVariables}
          onVariableChange={setPreviewVariables}
          onClose={() => setShowPreview(false)}
          onSendTest={handleSendTest}
        />
      )}
    </div>
  );
}
