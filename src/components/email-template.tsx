import * as React from "react";

interface Extra {
  name: string;
  quantity?: number;
}

interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

interface Customer {
  name: string;
  email: string;
  phone: string;
  address: Address;
}

interface EmailTemplateProps {
  orderId: string;
  customer: Customer;
  machineType: string;
  rentalDate: string;
  rentalTime: string;
  returnDate: string;
  returnTime: string;
  selectedMixers: string[];
  selectedExtras?: Extra[];
  amount: string;
  capacity: string;
}

export const EmailTemplate: React.FC<Readonly<EmailTemplateProps>> = ({
  orderId,
  customer,
  machineType,
  rentalDate,
  rentalTime,
  returnDate,
  returnTime,
  selectedMixers,
  selectedExtras = [],
  amount,
  capacity,
}) => (
  <div
    style={{
      fontFamily: "Arial, sans-serif",
      maxWidth: "600px",
      margin: "0 auto",
      padding: "20px",
      color: "#333",
      backgroundColor: "#f9fafb",
      borderRadius: "8px",
    }}
  >
    <h1
      style={{
        color: "#2b6cb0",
        textAlign: "center",
        marginBottom: "30px",
        paddingBottom: "15px",
        borderBottom: "2px solid #e2e8f0",
      }}
    >
      Thank you for your order!
    </h1>
    <p style={{ fontSize: "16px" }}>Dear {customer.name},</p>
    <p style={{ fontSize: "16px" }}>
      We have received your rental order for a {machineType}.
    </p>

    <div
      style={{
        backgroundColor: "#fff",
        padding: "15px",
        borderRadius: "6px",
        margin: "20px 0",
        border: "1px solid #e2e8f0",
      }}
    >
      <p style={{ margin: "0" }}>
        <strong style={{ color: "#2b6cb0" }}>Order ID:</strong> {orderId}
      </p>
    </div>

    <div
      style={{
        backgroundColor: "#fff",
        padding: "15px",
        borderRadius: "6px",
        margin: "20px 0",
        border: "1px solid #e2e8f0",
      }}
    >
      <p style={{ margin: "0 0 10px 0" }}>
        <strong style={{ color: "#2b6cb0" }}>Rental Details:</strong>
      </p>
      <ul style={{ listStyleType: "none", padding: "0", margin: "0" }}>
        <li style={{ marginBottom: "8px" }}>
          🗓 Rental Date: {rentalDate} at {rentalTime}
        </li>
        <li style={{ marginBottom: "8px" }}>
          🗓 Return Date: {returnDate} at {returnTime}
        </li>
        <li style={{ marginBottom: "8px" }}>
          🍹 Selected Mixers: {selectedMixers.join(", ")}
        </li>
        {selectedExtras && selectedExtras.length > 0 && (
          <li style={{ marginBottom: "8px" }}>
            🎉 Party Extras:{" "}
            {selectedExtras
              .map(
                (extra) =>
                  `${extra.name}${extra.quantity && extra.quantity > 1 ? ` (${extra.quantity}x)` : ""}`,
              )
              .join(", ")}
          </li>
        )}
        <li style={{ marginBottom: "8px" }}>💰 Total Amount: ${amount}</li>
        <li style={{ marginBottom: "8px" }}>
          ⚡ Machine Capacity: {capacity}L
        </li>
      </ul>
    </div>

    <div
      style={{
        backgroundColor: "#fff",
        padding: "15px",
        borderRadius: "6px",
        margin: "20px 0",
        border: "1px solid #e2e8f0",
      }}
    >
      <p style={{ margin: "0 0 10px 0" }}>
        <strong style={{ color: "#2b6cb0" }}>Delivery Address:</strong>
      </p>
      <p style={{ margin: "0" }}>
        {customer.address.street}
        <br />
        {customer.address.city}, {customer.address.state}{" "}
        {customer.address.zipCode}
      </p>
    </div>

    <div
      style={{
        backgroundColor: "#fff",
        padding: "15px",
        borderRadius: "6px",
        margin: "20px 0",
        border: "1px solid #e2e8f0",
      }}
    >
      <p style={{ margin: "0 0 10px 0" }}>
        <strong style={{ color: "#2b6cb0" }}>Contact Information:</strong>
      </p>
      <ul style={{ listStyleType: "none", padding: "0", margin: "0" }}>
        <li style={{ marginBottom: "8px" }}>📱 Phone: {customer.phone}</li>
        <li style={{ marginBottom: "8px" }}>📧 Email: {customer.email}</li>
      </ul>
    </div>

    <p
      style={{
        fontSize: "16px",
        backgroundColor: "#fff",
        padding: "15px",
        borderRadius: "6px",
        margin: "20px 0",
        border: "1px solid #e2e8f0",
      }}
    >
      If you have any questions or need to make changes to your order, please do
      not hesitate to contact us. Please reference your Order ID in any
      communications.
    </p>

    <p
      style={{
        marginTop: "30px",
        paddingTop: "20px",
        borderTop: "2px solid #e2e8f0",
      }}
    >
      Best regards,
      <br />
      SATX Ritas Margarita Rentals Team
    </p>
  </div>
);
