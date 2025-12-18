/**
 * Multi-tenant type definitions for QueueWise Clinic
 *
 * These types support the migration from single-tenant to multi-tenant architecture.
 * They are designed to work alongside legacy data structures during the transition period.
 */

import { Timestamp } from "firebase/firestore";

/**
 * User roles in the multi-tenant system
 */
export type UserRole = 'owner' | 'doctor' | 'nurse';

/**
 * User profile - maps Firebase Auth UID to clinic membership and role
 * This is the single source of truth for user permissions and clinic association
 *
 * Document ID: Firebase Auth UID
 * Collection: userProfiles/{uid}
 */
export interface UserProfile {
  // Identity
  uid: string;                      // Firebase Auth UID (same as document ID)
  email: string;                    // User's email address
  displayName: string;              // User's display name

  // Clinic Association
  clinicId: string;                 // Primary clinic ID this user belongs to
  role: UserRole;                   // User's role in the clinic

  // Role-Specific References
  doctorId?: string;                // If role=owner or doctor, reference to doctors/{doctorId}
  nurseId?: string;                 // If role=nurse, reference to nurses/{nurseId}

  // Status
  isActive: boolean;                // Can be deactivated by clinic owner

  // Timestamps
  createdAt: Timestamp | Date;
  lastLoginAt?: Timestamp | Date;

  // Invitation Tracking (optional)
  invitedBy?: string;               // UID of user who invited this user
  invitedAt?: Timestamp | Date;
  acceptedAt?: Timestamp | Date;
}

/**
 * Clinic settings structure
 */
export interface ClinicSettings {
  consultationTime: number;         // Minutes per consultation
  consultationCost: number;         // Price for new consultation
  reConsultationCost: number;       // Price for re-consultation
  timezone?: string;                // Timezone (e.g., "Africa/Cairo")
  language?: string;                // Language code (e.g., "ar")
}

/**
 * Clinic - top-level tenant container
 *
 * Document ID: Auto-generated
 * Collection: clinics/{clinicId}
 */
export interface Clinic {
  // Identity (document ID is clinicId)
  id?: string;                      // Document ID (optional when creating)
  name: string;                     // Clinic name
  slug: string;                     // URL-friendly unique identifier
  ownerUid: string;                 // Firebase Auth UID of clinic owner (primary)

  // Owner Information (for compatibility)
  ownerId: string;                  // Firebase Auth UID of clinic owner
  ownerName: string;                // Owner's display name
  ownerEmail: string;               // Owner's email

  // Settings
  settings: ClinicSettings;

  // Contact Information
  phoneNumbers: string[];           // Clinic phone numbers
  locations: string[];              // Physical locations

  // Branding (optional)
  logoUrl?: string;
  primaryColor?: string;

  // Subscription (optional - for future SaaS features)
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
  subscriptionStatus?: 'active' | 'suspended' | 'cancelled';
  subscriptionExpiresAt?: Timestamp | Date;

  // Statistics (optional)
  stats?: {
    totalDoctors: number;
    totalNurses: number;
    totalPatients: number;
    totalRevenue: number;
  };

  // Status
  isActive?: boolean;               // Can be deactivated by platform admin

  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/**
 * Doctor profile within a clinic
 *
 * Document ID: Auto-generated (NOT Firebase Auth UID after migration)
 * Collection: doctors/{doctorId}
 */
export interface Doctor {
  // Identity
  id?: string;                      // Document ID (optional when creating)
  userId: string;                   // Firebase Auth UID
  clinicId: string;                 // Parent clinic ID

  // Profile Information
  name: string;
  email: string;
  specialty: string;
  avatarUrl?: string;

  // Doctor-Specific Settings
  personalPhoneNumbers?: string[];  // Doctor's direct line (optional)
  consultationLocations?: string[]; // Specific locations doctor works at

  // Status
  isActive: boolean;                // Can be deactivated by clinic owner
  isAvailable: boolean;             // Current availability (toggleable by doctor)

  // Permissions (optional - for fine-grained control)
  permissions?: {
    canManageSettings?: boolean;    // Can edit clinic settings
    canManageStaff?: boolean;       // Can invite/remove staff
    canViewRevenue?: boolean;       // Can view financial data
  };

  // Statistics
  totalRevenue: number;             // Doctor's accumulated revenue

  // Timestamps
  createdAt: Timestamp | Date;
  addedBy: string;                  // UID of user who added this doctor
}

/**
 * Nurse profile within a clinic
 *
 * Document ID: Auto-generated (NOT Firebase Auth UID after migration)
 * Collection: nurses/{nurseId}
 */
export interface Nurse {
  // Identity
  id?: string;                      // Document ID (optional when creating)
  userId: string;                   // Firebase Auth UID
  clinicId: string;                 // Parent clinic ID

  // Profile Information
  name: string;
  email: string;
  avatarUrl?: string;

  // Assignment (optional)
  assignedDoctorIds?: string[];     // Specific doctors this nurse works with

  // Status
  isActive: boolean;                // Can be deactivated by clinic owner

  // Timestamps
  createdAt: Timestamp | Date;
  addedBy: string;                  // UID of user who added this nurse
}

/**
 * Legacy doctor profile (existing structure)
 * Used for backward compatibility during migration
 */
export interface LegacyDoctorProfile {
  name: string;
  specialty: string;
  clinicPhoneNumbers: string[];
  locations: string[];
  avatarUrl?: string;
  isAvailable?: boolean;
  totalRevenue?: number;
}

/**
 * Legacy nurse profile (existing structure)
 * Used for backward compatibility during migration
 */
export interface LegacyNurseProfile {
  name: string;
  email: string;
  avatarUrl?: string;
}

/**
 * Helper type for legacy profile detection
 */
export interface LegacyUserProfile {
  uid: string;
  role: 'doctor' | 'nurse';
  isLegacy: true;                   // Flag to indicate this is a legacy profile
  displayName: string;
  email: string;
  // No clinicId or doctorId/nurseId in legacy mode
}

/**
 * Patient source - indicates how the patient was registered
 */
export type PatientSource = 'patient' | 'nurse';

/**
 * Booking Ticket - public-safe status information
 * 
 * This collection provides privacy-safe read access for public status pages.
 * Contains minimal non-sensitive information that can be displayed publicly.
 * 
 * Document ID: Auto-generated ticket ID
 * Collection: bookingTickets/{ticketId}
 */
export interface BookingTicket {
  // Identity
  id?: string;                      // Document ID (optional when creating)
  
  // References
  clinicId: string;                 // Clinic this booking belongs to
  doctorId: string;                 // Doctor assigned to this booking
  patientId: string;                // Reference to patients/{patientId}
  
  // Public Display Information (non-sensitive)
  queueNumber: number;              // Queue position
  status: 'Waiting' | 'Consulting' | 'Finished';
  displayName?: string;             // Optional sanitized name (e.g., "أ.م" instead of full name)
  phoneLast4?: string;              // Last 4 digits of phone for verification
  
  // Timing
  createdAt: Timestamp | Date;
  expiresAt: Timestamp | Date;      // Typically end of booking day
  
  // Optional clinic message
  message?: string;                 // Clinic-wide message to patients
}

/**
 * Queue State - public-safe queue progress tracking
 * 
 * This collection tracks the current state of each doctor's queue.
 * Used by public status pages to calculate position without listing all tickets.
 * 
 * Document ID: {clinicId}_{doctorId}
 * Collection: queueState/{clinicId}_{doctorId}
 */
export interface QueueState {
  // Identity
  id?: string;                      // Document ID: "{clinicId}_{doctorId}"
  clinicId: string;                 // Clinic reference
  doctorId: string;                 // Doctor reference
  
  // Current State
  currentConsultingQueueNumber: number | null;  // Queue number currently being served (null if none)
  
  // Status
  isOpen: boolean;                  // Whether queue is accepting patients
  
  // Timestamps
  updatedAt: Timestamp | Date;      // Last update time
}

/**
 * Platform Admin - super admin for managing clinic customers
 * 
 * Document ID: Firebase Auth UID
 * Collection: platformAdmins/{uid}
 */
export interface PlatformAdmin {
  uid: string;                      // Firebase Auth UID (same as document ID)
  email: string;                    // Admin email
  displayName?: string;             // Admin display name
  isActive: boolean;                // Can be deactivated to revoke access
  createdAt: Timestamp | Date;      // When admin was created
  createdBy?: string;               // UID of who created this admin
}

/**
 * Platform Client - represents a clinic customer/subscription
 * 
 * Document ID: Auto-generated
 * Collection: platformClients/{clientId}
 */
export interface PlatformClient {
  id?: string;                      // Document ID (optional when creating)
  
  // Clinic Reference
  clinicId: string;                 // Reference to clinics/{clinicId}
  clinicName: string;               // Clinic name (denormalized for display)
  clinicSlug: string;               // Clinic slug (denormalized for display)
  
  // Owner Reference
  ownerUid: string;                 // Firebase Auth UID of clinic owner
  ownerEmail: string;               // Owner email address
  ownerName?: string;               // Owner display name (optional)
  
  // Subscription
  plan: 'monthly' | 'yearly' | 'trial';  // Subscription plan
  status: 'active' | 'suspended' | 'canceled';  // Subscription status
  
  // Billing Period
  currentPeriodStart: Timestamp | Date;   // Start of current billing period
  currentPeriodEnd: Timestamp | Date;     // End of current billing period
  
  // Timestamps
  createdAt: Timestamp | Date;      // When client was created
  updatedAt: Timestamp | Date;      // Last update
  canceledAt?: Timestamp | Date;    // When subscription was canceled (if applicable)
  
  // Audit
  createdBy: string;                // UID of platform admin who created this client
  lastModifiedBy?: string;          // UID of last admin who modified
}
