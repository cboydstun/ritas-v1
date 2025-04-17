"use client";

import { useState, useEffect } from "react";
import { ISentEmail } from "@/models/email-template";

export default function SentEmailList() {
  const [emails, setEmails] = useState<ISentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEmails, setTotalEmails] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [selectedEmail, setSelectedEmail] = useState<ISentEmail | null>(null);

  // Fetch emails on component mount and when page or status filter changes
  useEffect(() => {
    fetchEmails();
  }, [page, statusFilter]);

  // Fetch sent emails
  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query string
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("limit", "10");
      if (statusFilter) {
        queryParams.append("status", statusFilter);
      }
      
      const response = await fetch(`/api/admin/sent-emails?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching emails: ${response.statusText}`);
      }
      
      const data = await response.json();
      setEmails(data.emails);
      setTotalPages(data.pages);
      setTotalEmails(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching sent emails:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch email details
  const fetchEmailDetails = async (id: string) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/admin/sent-emails/${id}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching email details: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSelectedEmail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching email details:", err);
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "delivered":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "bounced":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          Sent Emails
        </h2>
        
        {/* Status filter */}
        <div>
          <select
            value={statusFilter || ""}
            onChange={(e) => {
              setStatusFilter(e.target.value || undefined);
              setPage(1); // Reset to first page when filter changes
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="bounced">Bounced</option>
          </select>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !selectedEmail && <div className="text-center py-4">Loading...</div>}

      {/* Email list */}
      {!loading && emails.length === 0 && (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            No sent emails found.
          </p>
        </div>
      )}

      {/* Email list table */}
      {emails.length > 0 && !selectedEmail && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Subject
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Recipients
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Status
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
              {emails.map((email) => (
                <tr key={email._id?.toString()}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {email.subject}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {email.to.join(", ")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(email.sentAt.toString())}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                        email.status
                      )}`}
                    >
                      {email.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => fetchEmailDetails(email._id?.toString() || "")}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !selectedEmail && (
        <div className="flex justify-between items-center mt-6">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing page {page} of {totalPages} ({totalEmails} total emails)
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className={`px-3 py-1 rounded ${
                page === 1
                  ? "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed"
                  : "bg-teal text-white hover:bg-teal-600"
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className={`px-3 py-1 rounded ${
                page === totalPages
                  ? "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed"
                  : "bg-teal text-white hover:bg-teal-600"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Email detail view */}
      {selectedEmail && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Email Details
            </h3>
            <button
              onClick={() => setSelectedEmail(null)}
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

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Subject
              </h4>
              <p className="text-gray-900 dark:text-white">{selectedEmail.subject}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                From
              </h4>
              <p className="text-gray-900 dark:text-white">{selectedEmail.from}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                To
              </h4>
              <p className="text-gray-900 dark:text-white">
                {selectedEmail.to.join(", ")}
              </p>
            </div>

            {selectedEmail.cc && selectedEmail.cc.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  CC
                </h4>
                <p className="text-gray-900 dark:text-white">
                  {selectedEmail.cc.join(", ")}
                </p>
              </div>
            )}

            {selectedEmail.bcc && selectedEmail.bcc.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  BCC
                </h4>
                <p className="text-gray-900 dark:text-white">
                  {selectedEmail.bcc.join(", ")}
                </p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Date
              </h4>
              <p className="text-gray-900 dark:text-white">
                {formatDate(selectedEmail.sentAt.toString())}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </h4>
              <span
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                  selectedEmail.status
                )}`}
              >
                {selectedEmail.status}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Content
              </h4>
              <div className="mt-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 max-h-[60vh] overflow-y-auto">
                <div
                  className="email-content"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
