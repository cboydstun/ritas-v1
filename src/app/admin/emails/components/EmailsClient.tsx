"use client";

import { useState } from "react";
import EmailTemplateList from "./EmailTemplateList";
import SentEmailList from "./SentEmailList";

type Tab = "templates" | "sent";

export default function EmailsClient() {
  const [activeTab, setActiveTab] = useState<Tab>("templates");

  return (
    <div>
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <ul className="flex flex-wrap -mb-px">
          <li className="mr-2">
            <button
              onClick={() => setActiveTab("templates")}
              className={`inline-block py-4 px-4 text-sm font-medium ${
                activeTab === "templates"
                  ? "text-teal border-b-2 border-teal"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Email Templates
            </button>
          </li>
          <li className="mr-2">
            <button
              onClick={() => setActiveTab("sent")}
              className={`inline-block py-4 px-4 text-sm font-medium ${
                activeTab === "sent"
                  ? "text-teal border-b-2 border-teal"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Sent Emails
            </button>
          </li>
        </ul>
      </div>

      {/* Content */}
      <div>
        {activeTab === "templates" && <EmailTemplateList />}
        {activeTab === "sent" && <SentEmailList />}
      </div>
    </div>
  );
}
