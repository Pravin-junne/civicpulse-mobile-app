// 0. Authentication
export { default as OnboardingScreen } from './auth/OnboardingScreen';
export { default as LoginScreen } from './auth/LoginScreen';

// 1. Dashboard & Telemetry
export { default as DashboardScreen } from './dashboard/DashboardScreen';
export { default as LiveTrackingScreen } from './dashboard/LiveTrackingScreen';

// 2. Grievance / Complaints Management
export { default as ComplaintsScreen } from './complaints/ComplaintsScreen';
export { default as NewComplaintScreen } from './complaints/NewComplaintScreen';
export { default as ComplaintDetailsScreen } from './complaints/ComplaintDetailsScreen';
export { default as CitizenTrackComplaintScreen } from './complaints/CitizenTrackComplaintScreen';

// 3. Appointments & Delegations
export { default as AppointmentScreen } from './appointments/AppointmentScreen';
export { default as AddAppointmentScreen } from './appointments/AddAppointmentScreen';

// 4. Municipal Asset Management
export { default as AssetManagementScreen } from './assets/AssetManagementScreen';
export { default as AddAssetScreen } from './assets/AddAssetScreen';

// 5. File Manager & Vault
export { default as FileManagerScreen } from './files/FileManagerScreen';

// 6. Budget & Expense Management
export { default as BudgetScreen } from './budget/BudgetScreen';
export { default as AddBudgetScreen } from './budget/AddBudgetScreen';
export { default as ExpenseScreen } from './budget/ExpenseScreen';
export { default as AddExpenseScreen } from './budget/AddExpenseScreen';

// 7. Event Management
export { default as EventManagementScreen } from './events/EventManagementScreen';
export { default as CreateEventScreen } from './events/CreateEventScreen';

// 8. Contact Directory
export { default as ContactDirectoryScreen } from './contacts/ContactDirectoryScreen';
export { default as AddContactScreen } from './contacts/AddContactScreen';

// 9. Social Media & Outreach
export { default as SocialMediaScreen } from './social/SocialMediaScreen';
export { default as SocialPostDetailScreen } from './social/SocialPostDetailScreen';
export { default as SocialInteractionDetailScreen } from './social/SocialPostDetailScreen';

// 10. Administration & Governance
export { default as DepartmentScreen } from './admin/DepartmentScreen';
export { default as AddDepartmentScreen } from './admin/AddDepartmentScreen';
export { default as WardsAreaScreen } from './admin/WardsAreaScreen';
export { default as AddWardScreen } from './admin/AddWardScreen';
export { default as UserScreen } from './admin/UserScreen';
export { default as AddUserScreen } from './admin/AddUserScreen';
export { default as ReportScreen } from './admin/ReportScreen';
