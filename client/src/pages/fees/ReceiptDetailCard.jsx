export default function ReceiptDetailCard({ receipt, remarks }) {
  if (!receipt) return null;

  return (
    <table className="table table-bordered cis-fee-receipt-detail mb-0">
      <tbody>
        <tr>
          <th>Receipt</th>
          <td>{receipt.receiptNo}</td>
        </tr>
        <tr>
          <th>Date</th>
          <td>{receipt.paidDate}</td>
        </tr>
        <tr>
          <th>Roll No.</th>
          <td>{receipt.registerNo}</td>
        </tr>
        <tr>
          <th>Name</th>
          <td>{receipt.studentName}</td>
        </tr>
        <tr>
          <th>Course</th>
          <td>{receipt.courseLabel}</td>
        </tr>
        <tr>
          <th>Fee Details</th>
          <td>
            {receipt.feeLines?.map((line) => (
              <div key={line.label}>{line.label}</div>
            ))}
          </td>
        </tr>
        <tr>
          <th>Fee Amount</th>
          <td>{receipt.totalAmount}</td>
        </tr>
        {remarks ? (
          <tr>
            <th>Remarks</th>
            <td>{remarks}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
