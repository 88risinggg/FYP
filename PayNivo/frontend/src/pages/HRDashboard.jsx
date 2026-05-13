import DashboardShell from "../components/DashboardShell.jsx";

export default function HRDashboard() {
  return (
    <DashboardShell
      role="HR"
      title="HR Dashboard"
      description="Placeholder for staff records, Excel uploads, payroll preparation, and payslip workflows."
      sections={[
        { title: "Staff profiles", text: "Future staff data management and employment details belong here." },
        { title: "Excel uploads", text: "Future ExcelJS and Multer upload screens belong here." },
        { title: "Payroll records", text: "Future payroll review and payslip generation screens belong here." }
      ]}
    />
  );
}
