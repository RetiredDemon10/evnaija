import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { ProtectedShell } from '@/components/layout/ProtectedShell'
import { PwaPrompt } from '@/components/pwa/PwaPrompt'
import { PageLoader } from '@/components/ui/Feedback'

// Every route is lazy-loaded so the public landing page does not ship the
// operator/admin dashboards, charting library or map engine up front.
const HomePage = lazy(() => import('@/pages/public/HomePage'))
const StationsPage = lazy(() => import('@/pages/public/StationsPage'))
const StationDetailPage = lazy(() => import('@/pages/public/StationDetailPage'))
const HowItWorksPage = lazy(() => import('@/pages/public/HowItWorksPage'))
const ForOperatorsPage = lazy(() => import('@/pages/public/ForOperatorsPage'))
const AboutPage = lazy(() => import('@/pages/public/AboutPage'))
const ContactPage = lazy(() => import('@/pages/public/ContactPage'))
const LegalPage = lazy(() => import('@/pages/public/LegalPage'))
const ManageBookingPage = lazy(() => import('@/pages/public/ManageBookingPage'))
const MechanicsPage = lazy(() => import('@/pages/public/MechanicsPage'))
const MechanicDetailPage = lazy(() => import('@/pages/public/MechanicDetailPage'))
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'))

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const RegisterOperatorPage = lazy(() => import('@/pages/auth/RegisterOperatorPage'))
const RegisterMechanicPage = lazy(() => import('@/pages/auth/RegisterMechanicPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'))

const CustomerOverviewPage = lazy(() => import('@/pages/app/CustomerOverviewPage'))
const CustomerStationsPage = lazy(() => import('@/pages/app/CustomerStationsPage'))
const BookingPage = lazy(() => import('@/pages/app/BookingPage'))
const BookingsPage = lazy(() => import('@/pages/app/BookingsPage'))
const BookingDetailPage = lazy(() => import('@/pages/app/BookingDetailPage'))
const PaymentCallbackPage = lazy(() => import('@/pages/app/PaymentCallbackPage'))
const GuestBookingPage = lazy(() => import('@/pages/app/GuestBookingPage'))
const PaymentsPage = lazy(() => import('@/pages/app/PaymentsPage'))
const VehiclesPage = lazy(() => import('@/pages/app/VehiclesPage'))
const SavedStationsPage = lazy(() => import('@/pages/app/SavedStationsPage'))
const RewardsPage = lazy(() => import('@/pages/app/RewardsPage'))
const AlertsPage = lazy(() => import('@/pages/app/AlertsPage'))
const ReviewsPage = lazy(() => import('@/pages/app/ReviewsPage'))
const ProfilePage = lazy(() => import('@/pages/app/ProfilePage'))

const MechanicOverviewPage = lazy(() => import('@/pages/mechanic/MechanicOverviewPage'))
const MechanicListingPage = lazy(() => import('@/pages/mechanic/MechanicListingPage'))
const MechanicRequestsPage = lazy(() => import('@/pages/mechanic/MechanicRequestsPage'))

const OperatorOverviewPage = lazy(() => import('@/pages/operator/OperatorOverviewPage'))
const StationsListPage = lazy(() => import('@/pages/operator/StationsListPage'))
const StationFormPage = lazy(() => import('@/pages/operator/StationFormPage'))
const ChargersPage = lazy(() => import('@/pages/operator/ChargersPage'))
const AvailabilityPage = lazy(() => import('@/pages/operator/AvailabilityPage'))
const OperatorBookingsPage = lazy(() => import('@/pages/operator/OperatorBookingsPage'))
const OperatorBookingDetailPage = lazy(() => import('@/pages/operator/OperatorBookingDetailPage'))
const OperatorCustomersPage = lazy(() => import('@/pages/operator/OperatorCustomersPage'))
const OperatorRevenuePage = lazy(() => import('@/pages/operator/OperatorRevenuePage'))
const TransactionsPage = lazy(() => import('@/pages/operator/TransactionsPage'))
const PayoutsPage = lazy(() => import('@/pages/operator/PayoutsPage'))
const OperatorReviewsPage = lazy(() => import('@/pages/operator/OperatorReviewsPage'))
const OperatorProfilePage = lazy(() => import('@/pages/operator/OperatorProfilePage'))

const NotificationsPage = lazy(() => import('@/pages/shared/NotificationsPage'))
const SupportPage = lazy(() => import('@/pages/shared/SupportPage'))

const AdminOverviewPage = lazy(() => import('@/pages/admin/AdminOverviewPage'))
const AdminCustomersPage = lazy(() => import('@/pages/admin/AdminCustomersPage'))
const AdminOperatorsPage = lazy(() => import('@/pages/admin/AdminOperatorsPage'))
const AdminVerificationPage = lazy(() => import('@/pages/admin/AdminVerificationPage'))
const AdminStationsPage = lazy(() => import('@/pages/admin/AdminStationsPage'))
const AdminChargersPage = lazy(() => import('@/pages/admin/AdminChargersPage'))
const AdminBookingsPage = lazy(() => import('@/pages/admin/AdminBookingsPage'))
const AdminPaymentsPage = lazy(() => import('@/pages/admin/AdminPaymentsPage'))
const AdminTransactionsPage = lazy(() => import('@/pages/admin/AdminTransactionsPage'))
const AdminRefundsPage = lazy(() => import('@/pages/admin/AdminRefundsPage'))
const AdminPayoutsPage = lazy(() => import('@/pages/admin/AdminPayoutsPage'))
const AdminCommissionPage = lazy(() => import('@/pages/admin/AdminCommissionPage'))
const AdminReviewsPage = lazy(() => import('@/pages/admin/AdminReviewsPage'))
const AdminNotificationsPage = lazy(() => import('@/pages/admin/AdminNotificationsPage'))
const AdminSupportPage = lazy(() => import('@/pages/admin/AdminSupportPage'))
const AdminPromotionsPage = lazy(() => import('@/pages/admin/AdminPromotionsPage'))
const AdminLocationsPage = lazy(() => import('@/pages/admin/AdminLocationsPage'))
const AdminContentPage = lazy(() => import('@/pages/admin/AdminContentPage'))
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminAuditPage = lazy(() => import('@/pages/admin/AdminAuditPage'))
const AdminMechanicsPage = lazy(() => import('@/pages/admin/AdminMechanicsPage'))

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center bg-mint-50">
      <PageLoader label="Loading EV Naija" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <PwaPrompt />
      <Routes>
        {/* Public marketing site */}
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="stations" element={<StationsPage />} />
          <Route path="stations/:slug" element={<StationDetailPage />} />
          <Route
            path="book/:stationId"
            element={
              <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
                <BookingPage />
              </div>
            }
          />
          <Route path="book/confirmation/:id" element={<GuestBookingPage />} />
          <Route path="manage-booking" element={<ManageBookingPage />} />
          <Route path="mechanics" element={<MechanicsPage />} />
          <Route path="mechanics/:id" element={<MechanicDetailPage />} />
          <Route path="how-it-works" element={<HowItWorksPage />} />
          <Route path="for-operators" element={<ForOperatorsPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="legal/:doc" element={<LegalPage />} />
        </Route>

        {/* Authentication */}
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="register/operator" element={<RegisterOperatorPage />} />
        <Route path="register/mechanic" element={<RegisterMechanicPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />

        {/* Paystack redirect target. Kept public because the provider returns the browser here. */}
        <Route path="payment/callback" element={<PaymentCallbackPage />} />

        {/* Customer portal — any authenticated role can use driver features */}
        <Route path="app" element={<ProtectedShell allow={['customer', 'operator', 'admin']} />}>
          <Route index element={<CustomerOverviewPage />} />
          <Route path="stations" element={<CustomerStationsPage />} />
          <Route path="stations/:slug" element={<StationDetailPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="bookings/new/:stationId" element={<BookingPage />} />
          <Route path="bookings/:id" element={<BookingDetailPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="payments/callback" element={<PaymentCallbackPage />} />
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="saved" element={<SavedStationsPage />} />
          <Route path="rewards" element={<RewardsPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="support" element={<SupportPage />} />
        </Route>

        {/* EV mechanic portal */}
        <Route path="mechanic" element={<ProtectedShell allow={['mechanic', 'admin']} />}>
          <Route index element={<MechanicOverviewPage />} />
          <Route path="listing" element={<MechanicListingPage />} />
          <Route path="requests" element={<MechanicRequestsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="support" element={<SupportPage />} />
        </Route>

        {/* Operator portal */}
        <Route path="operator" element={<ProtectedShell allow={['operator', 'admin']} />}>
          <Route index element={<OperatorOverviewPage />} />
          <Route path="stations" element={<StationsListPage />} />
          <Route path="stations/new" element={<StationFormPage />} />
          <Route path="stations/:id/edit" element={<StationFormPage />} />
          <Route path="chargers" element={<ChargersPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="bookings" element={<OperatorBookingsPage />} />
          <Route path="bookings/:id" element={<OperatorBookingDetailPage />} />
          <Route path="customers" element={<OperatorCustomersPage />} />
          <Route path="revenue" element={<OperatorRevenuePage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="payouts" element={<PayoutsPage />} />
          <Route path="reviews" element={<OperatorReviewsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<OperatorProfilePage />} />
          <Route path="support" element={<SupportPage />} />
        </Route>

        {/* Admin portal */}
        <Route path="admin" element={<ProtectedShell allow={['admin']} />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="operators" element={<AdminOperatorsPage />} />
          <Route path="verification" element={<AdminVerificationPage />} />
          <Route path="stations" element={<AdminStationsPage />} />
          <Route path="mechanics" element={<AdminMechanicsPage />} />
          <Route path="chargers" element={<AdminChargersPage />} />
          <Route path="bookings" element={<AdminBookingsPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="transactions" element={<AdminTransactionsPage />} />
          <Route path="refunds" element={<AdminRefundsPage />} />
          <Route path="payouts" element={<AdminPayoutsPage />} />
          <Route path="commission" element={<AdminCommissionPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="support" element={<AdminSupportPage />} />
          <Route path="promotions" element={<AdminPromotionsPage />} />
          <Route path="locations" element={<AdminLocationsPage />} />
          <Route path="content" element={<AdminContentPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
