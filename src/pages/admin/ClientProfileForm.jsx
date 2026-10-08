import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, getAuthToken } from '../../api/client';
import AddressFields from '../../components/AddressFields';
import AddInformationModal from '../../components/AddInformationModal';
import AddClientNoteModal from '../../components/AddClientNoteModal';
import ClientCreateSuccessModal from '../../components/ClientCreateSuccessModal';
import ClientSaveSuccessModal from '../../components/ClientSaveSuccessModal';
import ClientLayoutTab from '../../components/ClientLayoutTab';
import ClientConfigurationTab from '../../components/ClientConfigurationTab';
import DiscardChangesModal from '../../components/DiscardChangesModal';
import PasswordField from '../../components/PasswordField';
import SetPasswordModal from '../../components/SetPasswordModal';
import { COUNTRIES } from '../../data/countries';
import { INDIAN_STATES } from '../../data/indianStates';

// Fixed domain half of every client login email
const LOGIN_EMAIL_DOMAIN = 'abkhanassociates.com';

// 10 Tabs in strict spec order (Module 2A - Section A)
const TABS = [
  { id: 'personal', label: 'Personal Information', icon: 'personal' },
  { id: 'business', label: 'Business Information', icon: 'business' },
  { id: 'registration', label: 'Registration & Compliance', icon: 'registration' },
  { id: 'bank', label: 'Bank Account Details', icon: 'bank' },
  { id: 'numbering', label: 'Document Numbering', icon: 'numbering' },
  { id: 'credentials', label: 'Client Login Credentials', icon: 'credentials' },
  { id: 'layout', label: 'Layout', icon: 'layout' },
  { id: 'configuration', label: 'Configuration', icon: 'configuration' },
  { id: 'gst-frequency', label: 'GST Filing Frequency', icon: 'gst-frequency' },
  { id: 'subscription', label: 'Subscription', icon: 'subscription' },
];

const CONSTITUTIONS = [
  'Proprietorship',
  'Partnership Firm',
  'Partnership',
  'LLP',
  'Private Limited',
  'Private Limited Company',
  'Individual',
  'One Person Company',
  'Trust',
  'Society',
];

const DOCUMENT_NUMBERING_TYPES = [
  { key: 'invoice', label: 'Tax Invoice', defaultPrefix: 'INV', defaultSep: '-', defaultNext: '01', prefixField: 'invoice_prefix', nextField: 'invoice_next_number' },
  { key: 'bill_of_supply', label: 'Bill of Supply', defaultPrefix: 'BOS', defaultSep: '/', defaultNext: '01', prefixField: 'bill_of_supply_prefix', nextField: 'bill_of_supply_next_number' },
  { key: 'credit_note', label: 'Credit Note', defaultPrefix: 'CN', defaultSep: '-', defaultNext: '01', prefixField: 'credit_note_prefix', nextField: 'credit_note_next_number' },
  { key: 'debit_note', label: 'Debit Note', defaultPrefix: 'DN', defaultSep: '/', defaultNext: '01', prefixField: 'debit_note_prefix', nextField: 'debit_note_next_number' },
  { key: 'quotation', label: 'Quotation', defaultPrefix: 'QUO', defaultSep: '-', defaultNext: '01', prefixField: 'quotation_prefix', nextField: 'quotation_next_number' },
  { key: 'delivery_challan', label: 'Delivery Challan', defaultPrefix: 'DC', defaultSep: '/', defaultNext: '01', prefixField: 'delivery_challan_prefix', nextField: 'delivery_challan_next_number' },
];

const DEFAULT_ACTIVITY_LOGS = [
  { id: 1, date_time: '08 Sep 2026, 02:15 PM', ip_address: '49.36.12.10', status: 'Success' },
  { id: 2, date_time: '05 Sep 2026, 11:20 AM', ip_address: '49.36.12.10', status: 'Success' },
  { id: 3, date_time: '01 Sep 2026, 04:15 PM', ip_address: '103.15.67.22', status: 'Success' },
  { id: 4, date_time: '28 Aug 2026, 10:05 AM', ip_address: '49.36.12.10', status: 'Success' },
  { id: 5, date_time: '21 Aug 2026, 06:30 PM', ip_address: '103.28.45.11', status: 'Failed' },
];

const empty = () => ({
  client_name: '', business_name: '', constitution_type: '', business_type: '',
  contact_person_name: '', designation: '', gender: '',
  date_of_incorporation: '', date_of_birth: '', mobile: '', alt_mobile: '',
  email: '', alt_email: '',
  address: '', address_line_1: '', address_line_2: '',
  city: '', state: '', state_code: '27',
  pincode: '', country: 'India', website: '',
  comm_same_as_above: true,
  comm_address_line_1: '', comm_address_line_2: '',
  comm_city: '', comm_state: '', comm_state_code: '27',
  comm_pincode: '', comm_country: 'India',
  applicable_from: '',
  registration_type: 'Regular',
  pan: '', aadhaar: '', gstin: '', has_gst: true, gst_compliance_enabled: true, dealer_type: 'regular',
  gst_filing_frequency: 'monthly', gstr1_filing_frequency: 'monthly', gstr2b_filing_frequency: 'monthly',
  opt_out: 'Monthly',
  composition_rate: '1.00', gst_portal_username: '', gst_portal_password: '',
  tan: '', tan_portal_username: '', tan_portal_password: '', it_portal_username: '', it_portal_password: '',
  udyam: '', shop_establishment: '', iec: '', cin: '', llpin: '', pt_reg: '', esic: '', pf: '',
  // Registration & Compliance modular fields (PDF Page 16)
  pan_status: 'Active', name_as_per_pan: '', pan_allotment_date: '', pan_enabled: true,
  gst_status: 'Active', gst_registration_date: '', state_jurisdiction: '', gst_enabled: true,
  tan_status: 'Active', tan_allotment_date: '', tan_enabled: true,
  cin_incorporation_date: '', cin_certificate_no: '', cin_incorporation_place: '', cin_enabled: true,
  udyam_enterprise_type: 'Micro', udyam_registration_date: '', udyam_status: 'Active', udyam_enabled: true,
  shop_act_issuing_authority: '', shop_act_registration_date: '', shop_act_status: 'Inactive', shop_act_enabled: false,
  fssai_no: '', fssai_license_type: 'Basic', fssai_registration_date: '', fssai_status: 'Active', fssai_enabled: true,
  iec_registration_date: '', iec_status: 'Inactive', iec_enabled: false,
  ptrc_state: 'Maharashtra', ptrc_registration_date: '', ptrc_status: 'Active', ptrc_enabled: false,
  ptec_no: '', ptec_state: 'Maharashtra', ptec_registration_date: '', ptec_status: 'Active', ptec_enabled: true,
  bank_name: '', bank_branch: '', bank_account: '', account_holder_name: '',
  bank_ifsc: '', swift_code: '', account_type: '', upi_id: '',
  client_code: '', password: '', is_active: true, login_prefix: '',
  two_factor_enabled: false, session_timeout_minutes: 30, last_login_at: '',
  password_updated_at: '', password_updated_by: '',
  terms_conditions: '',
  invoice_prefix: 'INV', bill_of_supply_prefix: 'BOS', credit_note_prefix: 'CN',
  debit_note_prefix: 'DN', quotation_prefix: 'QUO', amendment_prefix: 'AMD', delivery_challan_prefix: 'DC',
  invoice_next_number: 1, bill_of_supply_next_number: 1, credit_note_next_number: 1,
  debit_note_next_number: 1, quotation_next_number: 1, amendment_next_number: 1, delivery_challan_next_number: 1,
  document_numbering_settings: {
    invoice: { prefix: 'INV', separator: '-', next_number: '01', prefix_position: 'first', numbering_type: 'auto', status: true },
    bill_of_supply: { prefix: 'BOS', separator: '/', next_number: '01', prefix_position: 'first', numbering_type: 'auto', status: true },
    credit_note: { prefix: 'CN', separator: '-', next_number: '01', prefix_position: 'first', numbering_type: 'auto', status: true },
    debit_note: { prefix: 'DN', separator: '/', next_number: '01', prefix_position: 'first', numbering_type: 'auto', status: true },
    quotation: { prefix: 'QUO', separator: '-', next_number: '01', prefix_position: 'first', numbering_type: 'auto', status: true },
    delivery_challan: { prefix: 'DC', separator: '/', next_number: '01', prefix_position: 'first', numbering_type: 'auto', status: true },
  },
  updated_at: '',
});

function TabIcon({ name, active }) {
  const stroke = active ? '#2563eb' : '#475569';
  switch (name) {
    case 'personal':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'business':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'registration':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'bank':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="21" x2="21" y2="21" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <polyline points="5 10 5 21" />
          <polyline points="19 10 19 21" />
          <polygon points="12 2 2 7 22 7 12 2" />
        </svg>
      );
    case 'numbering':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="9" x2="20" y2="9" />
          <line x1="4" y1="15" x2="20" y2="15" />
          <line x1="10" y1="3" x2="8" y2="21" />
          <line x1="16" y1="3" x2="14" y2="21" />
        </svg>
      );
    case 'credentials':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'layout':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      );
    case 'configuration':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'gst-frequency':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'subscription':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      );
    default:
      return null;
  }
}

function BuildingIcon({ color = '#1e3a8a' }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="8" height="15" rx="1" />
      <rect x="13" y="3" width="8" height="19" rx="1" />
      <line x1="6" y1="11" x2="8" y2="11" />
      <line x1="6" y1="15" x2="8" y2="15" />
      <line x1="16" y1="7" x2="18" y2="7" />
      <line x1="16" y1="11" x2="18" y2="11" />
      <line x1="16" y1="15" x2="18" y2="15" />
    </svg>
  );
}

function formatLastUpdated(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' at ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return dateStr;
  }
}

function Field({ label, required, children, full, hint }) {
  return (
    <label className={full ? 'full' : undefined} style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#475569' }}>
        <span>
          {label}
          {required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
        </span>
        {hint && <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 500 }}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function RegCard({ title, icon, enabled, onToggle, isEditing, children, span2 = false }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '14px 16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        opacity: enabled ? 1 : 0.72,
        transition: 'all 0.2s ease',
        gridColumn: span2 ? 'span 2' : 'span 1',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon}
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>{title}</span>
          </div>
          <button
            type="button"
            disabled={!isEditing}
            onClick={onToggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: isEditing ? 'pointer' : 'default',
            }}
          >
            <div
              style={{
                width: 32,
                height: 18,
                borderRadius: 999,
                background: enabled ? '#2563eb' : '#cbd5e1',
                position: 'relative',
                transition: 'background-color 0.2s',
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 2,
                  left: enabled ? 16 : 2,
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: enabled ? '#2563eb' : '#64748b',
              }}
            >
              {enabled ? 'Enable' : 'Disable'}
            </span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 12px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function CompactField({ label, required, full, children }) {
  return (
    <div style={{ gridColumn: full ? 'span 2' : 'span 1' }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export default function ClientProfileForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isEdit = Boolean(id);
  const tab = searchParams.get('tab') || 'personal';
  const setTab = (newTab) => {
    setSearchParams({ tab: newTab });
  };

  // Tab 7 Layout Tab dirty tracking & discard guard
  const [layoutIsDirty, setLayoutIsDirty] = useState(false);
  const layoutDiscardRef = useRef(null);

  // Tab 8 Configuration Tab dirty tracking & discard guard
  const [configIsDirty, setConfigIsDirty] = useState(false);
  const configDiscardRef = useRef(null);

  const [pendingTabChange, setPendingTabChange] = useState(null);
  const [showLayoutDiscardModal, setShowLayoutDiscardModal] = useState(false);
  const [showConfigDiscardModal, setShowConfigDiscardModal] = useState(false);

  const handleTabClick = (newTab) => {
    if (newTab === tab) return;
    if (tab === 'layout' && layoutIsDirty) {
      setPendingTabChange(newTab);
      setShowLayoutDiscardModal(true);
      return;
    }
    if (tab === 'configuration' && configIsDirty) {
      setPendingTabChange(newTab);
      setShowConfigDiscardModal(true);
      return;
    }
    setTab(newTab);
  };

  // State Engine: Default is read-only for existing clients; editable for new clients
  const [isEditing, setIsEditing] = useState(!isEdit);
  const [form, setForm] = useState(empty());
  const [originalForm, setOriginalForm] = useState(empty());

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentLoginEmail, setCurrentLoginEmail] = useState('');

  // Modals state
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showCreateSuccess, setShowCreateSuccess] = useState(false);
  const [createdInfo, setCreatedInfo] = useState({ clientId: '', clientName: '', id: null });

  // Toast Notification State
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Additional Information (Tab 1)
  const [additionalInfos, setAdditionalInfos] = useState([]);
  const [showAddInfoModal, setShowAddInfoModal] = useState(false);
  const [selectedEditInfo, setSelectedEditInfo] = useState(null);

  // Client Login Credentials (Tab 6)
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(false);
  const [clientNotes, setClientNotes] = useState([]);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [loginActivity, setLoginActivity] = useState([]);

  // Bank IFSC Verification (Tab 4)
  const [ifscStatus, setIfscStatus] = useState({ verifying: false, success: false, error: '' });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankForm, setBankForm] = useState({
    id: null,
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    confirm_account_number: '',
    ifsc_code: '',
    branch: '',
    account_type: 'Current Account',
    is_primary: true,
    status: 'Active',
    remarks: '',
  });
  const [bankFormErr, setBankFormErr] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [bankIfscNotice, setBankIfscNotice] = useState({ verifying: false, success: false, error: '', message: '' });
  const [showBankForm, setShowBankForm] = useState(true);
  const [bankSuccessMsg, setBankSuccessMsg] = useState('');

  // GST Filing Rules (Tab 9)
  const [filingRules, setFilingRules] = useState(null);
  const [loadingFilingRules, setLoadingFilingRules] = useState(false);
  const [filingRulesErr, setFilingRulesErr] = useState('');

  // Document Numbering State & Helpers (Tab 5)
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState('invoice');

  const updateDocNumberingField = (key, field, val) => {
    setForm((f) => ({
      ...f,
      document_numbering_settings: {
        ...(f.document_numbering_settings || {}),
        [key]: {
          ...(f.document_numbering_settings?.[key] || {}),
          [field]: val,
        },
      },
    }));
  };

  const formatDocNumber = (cfg) => {
    if (!cfg) return '';
    const prefix = cfg.prefix || '';
    const sep = cfg.separator ?? '-';
    const num = cfg.next_number || '01';
    return cfg.prefix_position === 'last' ? `${num}${sep}${prefix}` : `${prefix}${sep}${num}`;
  };

  const formatNextDocNumber = (cfg) => {
    if (!cfg) return '';
    const prefix = cfg.prefix || '';
    const sep = cfg.separator ?? '-';
    const curNum = parseInt(cfg.next_number, 10) || 1;
    const nextNum = curNum + 1;
    const padLength = Math.max(2, (cfg.next_number || '').length);
    const padded = String(nextNum).padStart(padLength, '0');
    return cfg.prefix_position === 'last' ? `${padded}${sep}${prefix}` : `${prefix}${sep}${padded}`;
  };

  useEffect(() => {
    if (!isEdit) {
      setIsEditing(true);
      return;
    }
    api(`/admin/clients/${id}`)
      .then((d) => {
        const loginEmail = d.user?.email || '';
        const suffix = `@${LOGIN_EMAIL_DOMAIN}`;
        const loginPrefix = loginEmail.toLowerCase().endsWith(suffix.toLowerCase())
          ? loginEmail.slice(0, loginEmail.length - suffix.length)
          : '';

        const regType = d.registration_type || (d.dealer_type === 'composition' ? 'Composition' : 'Regular');
        const optOut = d.gst_filing_frequency === 'quarterly' ? 'Quarterly' : 'Monthly';

        const populated = {
          ...empty(),
          ...d,
          client_name: d.client_name || d.business_name || '',
          contact_person_name: d.contact_person_name || d.client_name || d.user?.name || '',
          mobile: d.mobile || d.user?.phone || '',
          email: d.email || d.user?.email || '',
          designation: d.designation || '',
          gender: d.gender || '',
          address_line_1: d.address_line_1 || d.address || '',
          address_line_2: d.address_line_2 || '',
          comm_same_as_above: d.comm_same_as_above !== false,
          comm_address_line_1: d.comm_address_line_1 || '',
          comm_address_line_2: d.comm_address_line_2 || '',
          comm_city: d.comm_city || '',
          comm_state: d.comm_state || '',
          comm_state_code: d.comm_state_code || '27',
          comm_pincode: d.comm_pincode || '',
          comm_country: d.comm_country || 'India',
          registration_type: regType,
          dealer_type: d.dealer_type || (regType === 'Composition' ? 'composition' : 'regular'),
          applicable_from: d.applicable_from || '2026-04-01',
          opt_out: optOut,
          pan_enabled: Boolean(d.pan_enabled),
          gst_enabled: Boolean(d.gst_enabled != null ? d.gst_enabled : d.has_gst),
          has_gst: Boolean(d.has_gst != null ? d.has_gst : d.gst_enabled),
          tan_enabled: Boolean(d.tan_enabled),
          cin_enabled: Boolean(d.cin_enabled),
          udyam_enabled: Boolean(d.udyam_enabled),
          shop_act_enabled: Boolean(d.shop_act_enabled),
          fssai_enabled: Boolean(d.fssai_enabled),
          iec_enabled: Boolean(d.iec_enabled),
          ptrc_enabled: Boolean(d.ptrc_enabled),
          ptec_enabled: Boolean(d.ptec_enabled),
          pan_status: d.pan_status || 'Active',
          name_as_per_pan: d.name_as_per_pan || d.client_name || '',
          gst_status: d.gst_status || 'Active',
          tan_status: d.tan_status || 'Active',
          udyam_enterprise_type: d.udyam_enterprise_type || 'Micro',
          udyam_status: d.udyam_status || 'Active',
          shop_act_status: d.shop_act_status || 'Inactive',
          fssai_license_type: d.fssai_license_type || 'Basic',
          fssai_status: d.fssai_status || 'Active',
          iec_status: d.iec_status || 'Inactive',
          ptrc_state: d.ptrc_state || 'Maharashtra',
          ptrc_status: d.ptrc_status || 'Active',
          ptec_state: d.ptec_state || 'Maharashtra',
          ptec_status: d.ptec_status || 'Active',
          two_factor_enabled: Boolean(d.two_factor_enabled),
          session_timeout_minutes: d.session_timeout_minutes ?? 30,
          last_login_at: d.user?.last_login_at || '',
          password: '',
          login_prefix: loginPrefix,
          is_active: d.user?.is_active ?? true,
          password_updated_at: d.user?.password_updated_at || '',
          password_updated_by: d.user?.password_updated_by || '',
          updated_at: d.updated_at || '',
        };

        const savedSettings = d.document_numbering_settings || {};
        populated.document_numbering_settings = {
          invoice: {
            prefix: savedSettings.invoice?.prefix || d.invoice_prefix || 'INV',
            separator: savedSettings.invoice?.separator ?? '-',
            next_number: String(savedSettings.invoice?.next_number ?? (d.invoice_next_number ?? '01')).padStart(2, '0'),
            prefix_position: savedSettings.invoice?.prefix_position || 'first',
            numbering_type: savedSettings.invoice?.numbering_type || 'auto',
            status: savedSettings.invoice?.status ?? true,
          },
          bill_of_supply: {
            prefix: savedSettings.bill_of_supply?.prefix || d.bill_of_supply_prefix || 'BOS',
            separator: savedSettings.bill_of_supply?.separator ?? '/',
            next_number: String(savedSettings.bill_of_supply?.next_number ?? (d.bill_of_supply_next_number ?? '01')).padStart(2, '0'),
            prefix_position: savedSettings.bill_of_supply?.prefix_position || 'first',
            numbering_type: savedSettings.bill_of_supply?.numbering_type || 'auto',
            status: savedSettings.bill_of_supply?.status ?? true,
          },
          credit_note: {
            prefix: savedSettings.credit_note?.prefix || d.credit_note_prefix || 'CN',
            separator: savedSettings.credit_note?.separator ?? '-',
            next_number: String(savedSettings.credit_note?.next_number ?? (d.credit_note_next_number ?? '01')).padStart(2, '0'),
            prefix_position: savedSettings.credit_note?.prefix_position || 'first',
            numbering_type: savedSettings.credit_note?.numbering_type || 'auto',
            status: savedSettings.credit_note?.status ?? true,
          },
          debit_note: {
            prefix: savedSettings.debit_note?.prefix || d.debit_note_prefix || 'DN',
            separator: savedSettings.debit_note?.separator ?? '/',
            next_number: String(savedSettings.debit_note?.next_number ?? (d.debit_note_next_number ?? '01')).padStart(2, '0'),
            prefix_position: savedSettings.debit_note?.prefix_position || 'first',
            numbering_type: savedSettings.debit_note?.numbering_type || 'auto',
            status: savedSettings.debit_note?.status ?? true,
          },
          quotation: {
            prefix: savedSettings.quotation?.prefix || d.quotation_prefix || 'QUO',
            separator: savedSettings.quotation?.separator ?? '-',
            next_number: String(savedSettings.quotation?.next_number ?? (d.quotation_next_number ?? '01')).padStart(2, '0'),
            prefix_position: savedSettings.quotation?.prefix_position || 'first',
            numbering_type: savedSettings.quotation?.numbering_type || 'auto',
            status: savedSettings.quotation?.status ?? true,
          },
          delivery_challan: {
            prefix: savedSettings.delivery_challan?.prefix || d.delivery_challan_prefix || 'DC',
            separator: savedSettings.delivery_challan?.separator ?? '/',
            next_number: String(savedSettings.delivery_challan?.next_number ?? (d.delivery_challan_next_number ?? '01')).padStart(2, '0'),
            prefix_position: savedSettings.delivery_challan?.prefix_position || 'first',
            numbering_type: savedSettings.delivery_challan?.numbering_type || 'auto',
            status: savedSettings.delivery_challan?.status ?? true,
          },
        };

        setForm(populated);
        setOriginalForm(populated);
        setCurrentLoginEmail(loginEmail);
        if (d.additional_infos && Array.isArray(d.additional_infos)) {
          setAdditionalInfos(d.additional_infos);
        }
        if (d.bank_accounts && Array.isArray(d.bank_accounts)) {
          setBankAccounts(d.bank_accounts);
        }
        if (d.notes && Array.isArray(d.notes)) {
          setClientNotes(d.notes);
        }
        setIsEditing(false); // Default read-only as per spec
      })
      .catch((e) => setErr(e.message));
  }, [id, isEdit]);

  // Load GST Filing Frequency Rules when on Tab 9 or when registration/opt-out/applicable_from changes
  useEffect(() => {
    if (tab !== 'gst-frequency' || !form.gst_enabled) return;
    const dealerType = form.registration_type === 'Composition' ? 'composition' : 'regular';
    const optOut = form.registration_type === 'Composition' ? 'Quarterly' : (form.opt_out || 'Monthly');
    const appFrom = form.applicable_from || '';

    setLoadingFilingRules(true);
    setFilingRulesErr('');
    api(`/admin/gst-filing-rules?dealer_type=${dealerType}&opt_out=${optOut}&applicable_from=${appFrom}`)
      .then((res) => {
        setFilingRules(res);
      })
      .catch((e) => {
        console.error('Failed to fetch filing rules:', e);
        setFilingRulesErr('Filing rules could not be loaded');
        setFilingRules(null);
      })
      .finally(() => {
        setLoadingFilingRules(false);
      });
  }, [tab, form.gst_enabled, form.registration_type, form.opt_out, form.applicable_from]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleStatus = async () => {
    if (!isEdit) return;
    try {
      await api(`/admin/clients/${id}/active`, { method: 'POST', body: { is_active: !form.is_active } });
      const nextActive = !form.is_active;
      setForm((f) => ({ ...f, is_active: nextActive }));
      setOriginalForm((f) => ({ ...f, is_active: nextActive }));
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleCancel = () => {
    if (!isEdit) {
      navigate('/admin/clients');
      return;
    }
    const isDirty = JSON.stringify(form) !== JSON.stringify(originalForm);
    if (isDirty) {
      setShowDiscardModal(true);
    } else if (isEditing) {
      setIsEditing(false);
      showToast('Edit mode cancelled. No changes were made.', 'warning');
    } else {
      navigate('/admin/clients');
    }
  };

  // Additional Information CRUD handlers
  const loadAdditionalInfos = async () => {
    if (!id) return;
    try {
      const list = await api(`/admin/clients/${id}/additional-info`);
      setAdditionalInfos(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to load additional info:', e);
    }
  };

  const handleDeleteInfo = async (infoId) => {
    if (!window.confirm('Are you sure you want to delete this information item?')) return;
    try {
      await api(`/admin/clients/${id}/additional-info/${infoId}`, { method: 'DELETE' });
      setAdditionalInfos((prev) => prev.filter((item) => item.id !== infoId));
      const nowIso = new Date().toISOString();
      setForm((f) => ({ ...f, updated_at: nowIso }));
      setOriginalForm((f) => ({ ...f, updated_at: nowIso }));
    } catch (e) {
      alert(e.message || 'Failed to delete information item.');
    }
  };

  // Client Notes (Tab 6) handlers
  const loadClientNotes = async () => {
    if (!id) return;
    try {
      const list = await api(`/admin/clients/${id}/notes`);
      setClientNotes(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to load client notes:', e);
    }
  };

  const handleSaveNote = async (noteContent) => {
    if (!noteContent || !noteContent.trim()) return;
    setSavingNote(true);
    try {
      if (editingNote) {
        await api(`/admin/clients/${id}/notes/${editingNote.id}`, {
          method: 'PUT',
          body: { note: noteContent.trim() },
        });
      } else {
        await api(`/admin/clients/${id}/notes`, {
          method: 'POST',
          body: { note: noteContent.trim() },
        });
      }
      await loadClientNotes();
      setShowNoteModal(false);
      setEditingNote(null);
    } catch (err) {
      alert(err.message || 'Failed to save note.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await api(`/admin/clients/${id}/notes/${noteId}`, { method: 'DELETE' });
      await loadClientNotes();
    } catch (err) {
      alert(err.message || 'Failed to delete note.');
    }
  };

  // Fetch Login Activity & Notes when on Tab 6
  useEffect(() => {
    if (tab === 'credentials' && id) {
      api(`/admin/clients/${id}/login-history`)
        .then((res) => {
          if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
            setLoginActivity(res.data);
          }
        })
        .catch(() => {});
      loadClientNotes();
    }
  }, [tab, id]);

  // Fetch Additional Info when on Tab 1
  useEffect(() => {
    if (tab === 'personal' && id) {
      loadAdditionalInfos();
    }
  }, [tab, id]);

  // Bank Accounts (Tab 4) handlers
  const loadBankAccounts = async () => {
    if (!id) return;
    try {
      const list = await api(`/admin/clients/${id}/bank-accounts`);
      setBankAccounts(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to load bank accounts:', e);
    }
  };

  const resetBankForm = () => {
    setBankForm({
      id: null,
      bank_name: '',
      account_holder_name: form.client_name || form.contact_person_name || '',
      account_number: '',
      confirm_account_number: '',
      ifsc_code: '',
      branch: '',
      account_type: 'Current Account',
      is_primary: bankAccounts.length === 0,
      status: 'Active',
      remarks: '',
    });
    setBankFormErr('');
    setBankIfscNotice({ verifying: false, success: false, error: '', message: '' });
  };

  const handleCancelBankForm = () => {
    resetBankForm();
    if (bankAccounts.length > 0) {
      setShowBankForm(false);
      const tbl = document.getElementById('bank-accounts-table-card');
      if (tbl) tbl.scrollIntoView({ behavior: 'smooth' });
    }
    showToast('Bank account form closed.', 'info');
  };

  const handleVerifyBankFormIfsc = async () => {
    const ifsc = (bankForm.ifsc_code || '').trim().toUpperCase();
    if (!ifsc || ifsc.length !== 11) {
      setBankIfscNotice({ verifying: false, success: false, error: 'Please enter a valid 11-character IFSC code.', message: '' });
      return;
    }
    setBankIfscNotice({ verifying: true, success: false, error: '', message: '' });
    try {
      const data = await api(`/admin/lookup/ifsc/${ifsc}`);
      if (data && data.success && (data.bank_name || data.bank)) {
        const bankName = data.bank_name || data.bank || '';
        const branchName = data.branch || data.bank_branch || '';
        setBankForm((b) => ({
          ...b,
          ifsc_code: ifsc,
          bank_name: bankName || b.bank_name,
          branch: branchName || b.branch,
        }));
        setBankIfscNotice({
          verifying: false,
          success: true,
          error: '',
          message: `Verified: ${bankName}${branchName ? ` (${branchName})` : ''}`,
        });
      } else {
        setBankIfscNotice({
          verifying: false,
          success: false,
          error: (data && data.message) || 'Invalid or not found IFSC code. You can enter Bank Name and Branch manually.',
          message: '',
        });
      }
    } catch (err) {
      setBankIfscNotice({
        verifying: false,
        success: false,
        error: err.message || 'Invalid or not found IFSC code. You can enter Bank Name and Branch manually.',
        message: '',
      });
    }
  };

  const handleEditBankAccount = (acc) => {
    setBankForm({
      id: acc.id,
      bank_name: acc.bank_name || '',
      account_holder_name: acc.account_holder_name || '',
      account_number: acc.account_number || '',
      confirm_account_number: acc.account_number || '',
      ifsc_code: acc.ifsc_code || '',
      branch: acc.branch || '',
      account_type: acc.account_type || 'Current Account',
      is_primary: Boolean(acc.is_primary),
      status: acc.status || 'Active',
      remarks: acc.remarks || '',
    });
    setBankFormErr('');
    setBankIfscNotice({ verifying: false, success: false, error: '', message: '' });
    setShowBankForm(true);
    setTimeout(() => {
      const el = document.getElementById('bank-form-card');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      document.getElementById('bank-name-input')?.focus();
    }, 60);
  };

  const handleDeleteBankAccount = async (bankId) => {
    if (!window.confirm('Are serious you want to delete this bank account?')) return;
    try {
      await api(`/admin/clients/${id}/bank-accounts/${bankId}`, { method: 'DELETE' });
      const refreshed = await api(`/admin/clients/${id}/bank-accounts`);
      const updatedList = Array.isArray(refreshed) ? refreshed : [];
      setBankAccounts(updatedList);
      if (bankForm.id === bankId) {
        resetBankForm();
      }
      const primary = updatedList.find((a) => a.is_primary);
      const nowIso = new Date().toISOString();
      setForm((f) => ({
        ...f,
        bank_name: primary ? primary.bank_name : '',
        bank_branch: primary ? primary.branch : '',
        bank_account: primary ? primary.account_number : '',
        account_holder_name: primary ? primary.account_holder_name : '',
        bank_ifsc: primary ? primary.ifsc_code : '',
        account_type: primary ? primary.account_type : '',
        updated_at: nowIso,
      }));
      setOriginalForm((f) => ({
        ...f,
        bank_name: primary ? primary.bank_name : '',
        bank_branch: primary ? primary.branch : '',
        bank_account: primary ? primary.account_number : '',
        account_holder_name: primary ? primary.account_holder_name : '',
        bank_ifsc: primary ? primary.ifsc_code : '',
        account_type: primary ? primary.account_type : '',
        updated_at: nowIso,
      }));
      setBankSuccessMsg('Bank account deleted successfully.');
      setTimeout(() => setBankSuccessMsg(''), 4000);
    } catch (e) {
      alert(e.message || 'Failed to delete bank account.');
    }
  };

  const handleSaveBankAccount = async (e) => {
    if (e) e.preventDefault();
    setBankFormErr('');

    if (!bankForm.bank_name.trim()) {
      setBankFormErr('Bank Name is required.');
      return;
    }
    if (!bankForm.account_holder_name.trim()) {
      setBankFormErr('Account Holder Name is required.');
      return;
    }
    if (!bankForm.account_number.trim()) {
      setBankFormErr('Account Number is required.');
      return;
    }
    if (bankForm.account_number.trim() !== bankForm.confirm_account_number.trim()) {
      setBankFormErr('Account Number and Confirm Account Number do not match.');
      return;
    }
    if (!bankForm.ifsc_code.trim()) {
      setBankFormErr('IFSC Code is required.');
      return;
    }

    setSavingBank(true);
    try {
      const payload = {
        bank_name: bankForm.bank_name.trim(),
        account_holder_name: bankForm.account_holder_name.trim(),
        account_number: bankForm.account_number.trim(),
        ifsc_code: bankForm.ifsc_code.trim().toUpperCase(),
        branch: bankForm.branch ? bankForm.branch.trim() : '',
        account_type: bankForm.account_type || 'Current Account',
        is_primary: bankForm.is_primary,
        status: bankForm.status || 'Active',
        remarks: bankForm.remarks ? bankForm.remarks.trim() : '',
      };

      const wasEditing = Boolean(bankForm.id);
      if (bankForm.id) {
        await api(`/admin/clients/${id}/bank-accounts/${bankForm.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/admin/clients/${id}/bank-accounts`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      await loadBankAccounts();

      if (payload.is_primary) {
        const nowIso = new Date().toISOString();
        setForm((prev) => ({
          ...prev,
          bank_name: payload.bank_name,
          bank_branch: payload.branch,
          bank_account: payload.account_number,
          account_holder_name: payload.account_holder_name,
          bank_ifsc: payload.ifsc_code,
          account_type: payload.account_type,
          updated_at: nowIso,
        }));
        setOriginalForm((prev) => ({
          ...prev,
          bank_name: payload.bank_name,
          bank_branch: payload.branch,
          bank_account: payload.account_number,
          account_holder_name: payload.account_holder_name,
          bank_ifsc: payload.ifsc_code,
          account_type: payload.account_type,
          updated_at: nowIso,
        }));
      }

      resetBankForm();
      setBankSuccessMsg(wasEditing ? 'Bank account updated successfully!' : 'Bank account saved successfully!');
      setTimeout(() => setBankSuccessMsg(''), 4000);
      const tbl = document.getElementById('bank-accounts-table-card');
      if (tbl) tbl.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      setBankFormErr(err.message || 'Failed to save bank account.');
    } finally {
      setSavingBank(false);
    }
  };

  // IFSC Verification handler
  const handleVerifyIfsc = async () => {
    const ifsc = (form.bank_ifsc || '').trim().toUpperCase();
    if (!ifsc || ifsc.length !== 11) {
      setIfscStatus({ verifying: false, success: false, error: 'Please enter a valid 11-character IFSC code.' });
      return;
    }
    setIfscStatus({ verifying: true, success: false, error: '' });
    try {
      const data = await api(`/admin/lookup/ifsc/${ifsc}`);
      const bankName = data.bank_name || data.bank || data.BANK || '';
      const branchName = data.branch || data.bank_branch || data.BRANCH || '';
      const swift = data.swift_code || data.swift || data.SWIFT || '';
      setForm((f) => ({
        ...f,
        bank_ifsc: ifsc,
        bank_name: bankName || f.bank_name,
        bank_branch: branchName || f.bank_branch,
        swift_code: swift || f.swift_code,
      }));
      setIfscStatus({ verifying: false, success: true, error: '' });
    } catch (err) {
      setIfscStatus({
        verifying: false,
        success: false,
        error: 'Invalid or not found IFSC code. You can enter Bank Name and Branch Name manually.',
      });
    }
  };


  // Password set/reset success handler
  const handlePasswordSuccess = (data) => {
    const nowIso = new Date().toISOString();
    setForm((f) => ({
      ...f,
      password_updated_at: data.password_updated_at || nowIso,
      password_updated_by: data.password_updated_by || 'admin',
      updated_at: nowIso,
    }));
    setOriginalForm((f) => ({
      ...f,
      password_updated_at: data.password_updated_at || nowIso,
      password_updated_by: data.password_updated_by || 'admin',
      updated_at: nowIso,
    }));
  };

  const save = async () => {
    setBusy(true);
    setErr('');

    // Tab 3 & Tab 9 Validation: For every card whose toggle is ON, validate required (*) fields
    if (form.gst_enabled) {
      if (!form.gstin?.trim()) {
        const msg = 'GSTIN is required when GST is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.registration_type?.trim()) {
        const msg = 'Registration Type is required when GST is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.gst_status?.trim()) {
        const msg = 'GST Status is required when GST is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.gst_registration_date?.trim()) {
        const msg = 'Date of Registration is required when GST is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.state_jurisdiction?.trim()) {
        const msg = 'State Jurisdiction is required when GST is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.applicable_from?.trim()) {
        const msg = 'Applicable From date is required when GST is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
    }

    if (form.pan_enabled) {
      if (!form.pan?.trim()) {
        const msg = 'PAN is required when PAN card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.pan_status?.trim()) {
        const msg = 'PAN Status is required when PAN card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.name_as_per_pan?.trim() && !form.client_name?.trim()) {
        const msg = 'Name as per PAN is required when PAN card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
    }

    if (form.tan_enabled) {
      if (!form.tan?.trim()) {
        const msg = 'TAN is required when TAN card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.tan_status?.trim()) {
        const msg = 'TAN Status is required when TAN card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
    }

    if (form.cin_enabled) {
      if (!form.cin?.trim()) {
        const msg = 'CIN is required when CIN card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.cin_incorporation_date?.trim() && !form.date_of_incorporation?.trim()) {
        const msg = 'Date of Incorporation is required when CIN card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
    }

    if (form.udyam_enabled) {
      if (!form.udyam?.trim()) {
        const msg = 'UDYAM Number is required when UDYAM card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.udyam_enterprise_type?.trim()) {
        const msg = 'Type of Enterprise is required when UDYAM card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.udyam_registration_date?.trim()) {
        const msg = 'Date of Registration is required when UDYAM card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.udyam_status?.trim()) {
        const msg = 'Status is required when UDYAM card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
    }

    if (form.fssai_enabled) {
      if (!form.fssai_no?.trim()) {
        const msg = 'FSSAI Number is required when FSSAI card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.fssai_status?.trim()) {
        const msg = 'Status is required when FSSAI card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
    }

    if (form.ptrc_enabled) {
      if (!form.ptrc_state?.trim()) {
        const msg = 'State is required when PTRC card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
    }

    if (form.ptec_enabled) {
      if (!form.ptec_no?.trim()) {
        const msg = 'PTEC Number is required when PTEC card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.ptec_state?.trim()) {
        const msg = 'State is required when PTEC card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
      if (!form.ptec_status?.trim()) {
        const msg = 'Status is required when PTEC card is enabled.';
        setErr(msg);
        showToast(msg, 'error');
        setBusy(false);
        return;
      }
    }

    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'password' && !v) return;
        if (k === 'dealer_type' && !form.has_gst) return;
        if (k === 'document_numbering_settings') return;
        if (k === 'is_active' || k === 'has_gst' || k === 'gst_compliance_enabled' || k === 'comm_same_as_above') return;
        if (typeof v === 'boolean') return;
        if (v != null && v !== '') fd.append(k, v);
      });
      // Synchronize address with address_line_1
      if (form.address_line_1) {
        fd.append('address', form.address_line_1);
      }
      const isGstActive = Boolean(form.gst_enabled);
      fd.append('has_gst', isGstActive ? '1' : '0');
      fd.append('gst_compliance_enabled', form.gst_compliance_enabled ? '1' : '0');
      fd.append('comm_same_as_above', form.comm_same_as_above ? '1' : '0');
      if (form.comm_same_as_above) {
        fd.set('comm_address_line_1', form.address_line_1 || '');
        fd.set('comm_address_line_2', form.address_line_2 || '');
        fd.set('comm_city', form.city || '');
        fd.set('comm_state', form.state || '');
        fd.set('comm_state_code', form.state_code || '27');
        fd.set('comm_pincode', form.pincode || '');
        fd.set('comm_country', form.country || 'India');
      }
      fd.append('is_active', form.is_active ? '1' : '0');

      const boolToggles = [
        'pan_enabled', 'gst_enabled', 'tan_enabled', 'cin_enabled',
        'udyam_enabled', 'shop_act_enabled', 'fssai_enabled', 'iec_enabled',
        'ptrc_enabled', 'ptec_enabled', 'two_factor_enabled',
      ];
      boolToggles.forEach((t) => {
        if (t === 'gst_enabled') {
          fd.set('gst_enabled', isGstActive ? '1' : '0');
        } else {
          fd.append(t, form[t] ? '1' : '0');
        }
      });

      if (form.pan_enabled && !fd.has('name_as_per_pan') && form.client_name) {
        fd.set('name_as_per_pan', form.client_name);
      }
      if (form.cin_enabled && !fd.has('cin_incorporation_date') && form.date_of_incorporation) {
        fd.set('cin_incorporation_date', form.date_of_incorporation);
      }

      // Dealer type and GST frequency synchronization per spec (only when GST is enabled)
      if (isGstActive) {
        const isComp = form.registration_type === 'Composition';
        fd.append('registration_type', form.registration_type || 'Regular');
        fd.append('dealer_type', isComp ? 'composition' : 'regular');
        if (isComp) {
          fd.append('gst_filing_frequency', 'quarterly');
          fd.append('gstr1_filing_frequency', '');
          fd.append('gstr2b_filing_frequency', '');
        } else {
          const isQrmp = form.opt_out === 'Quarterly';
          fd.append('gst_filing_frequency', isQrmp ? 'quarterly' : 'monthly');
          fd.append('gstr1_filing_frequency', 'monthly');
          fd.append('gstr2b_filing_frequency', isQrmp ? 'quarterly' : 'monthly');
        }
      }

      // Document Numbering settings synchronization per spec
      if (form.document_numbering_settings) {
        fd.append('document_numbering_settings', JSON.stringify(form.document_numbering_settings));
        const numSettings = form.document_numbering_settings;
        if (numSettings.invoice) {
          fd.set('invoice_prefix', numSettings.invoice.prefix || 'INV');
          fd.set('invoice_next_number', parseInt(numSettings.invoice.next_number, 10) || 1);
        }
        if (numSettings.bill_of_supply) {
          fd.set('bill_of_supply_prefix', numSettings.bill_of_supply.prefix || 'BOS');
          fd.set('bill_of_supply_next_number', parseInt(numSettings.bill_of_supply.next_number, 10) || 1);
        }
        if (numSettings.credit_note) {
          fd.set('credit_note_prefix', numSettings.credit_note.prefix || 'CN');
          fd.set('credit_note_next_number', parseInt(numSettings.credit_note.next_number, 10) || 1);
        }
        if (numSettings.debit_note) {
          fd.set('debit_note_prefix', numSettings.debit_note.prefix || 'DN');
          fd.set('debit_note_next_number', parseInt(numSettings.debit_note.next_number, 10) || 1);
        }
        if (numSettings.quotation) {
          fd.set('quotation_prefix', numSettings.quotation.prefix || 'QUO');
          fd.set('quotation_next_number', parseInt(numSettings.quotation.next_number, 10) || 1);
        }
        if (numSettings.delivery_challan) {
          fd.set('delivery_challan_prefix', numSettings.delivery_challan.prefix || 'DC');
          fd.set('delivery_challan_next_number', parseInt(numSettings.delivery_challan.next_number, 10) || 1);
        }
      }

      const token = getAuthToken();
      const url = isEdit ? `/api/admin/clients/${id}` : '/api/admin/clients';
      if (isEdit) fd.append('_method', 'PUT');

      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');

      if (isEdit) {
        const nextData = {
          ...form,
          ...data,
          updated_at: data.updated_at || new Date().toISOString(),
          password: '',
        };
        setForm(nextData);
        setOriginalForm(nextData);
        setIsEditing(false);
        setShowSaveSuccess(true);
      } else {
        setCreatedInfo({
          clientId: data.client_code || `CL-${String(data.id).padStart(3, '0')}`,
          clientName: data.client_name || form.client_name,
          id: data.id,
        });
        setShowCreateSuccess(true);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* Breadcrumb & Title */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: 'var(--bp-muted, #64748b)', marginBottom: 6 }}>
          <Link to="/admin/clients" style={{ color: 'var(--bp-blue, #2563eb)', textDecoration: 'none' }}>Clients</Link>
          {' > '}
          <span>Manage Client</span>
          {tab && (
            <>
              {' > '}
              <span style={{ color: 'var(--bp-text, #0f172a)', fontWeight: 600 }}>
                {TABS.find((t) => t.id === tab)?.label || 'Personal Information'}
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1d4ed8' }}>
              {isEdit ? 'Manage Client' : 'Add New Client'}
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
              {isEdit ? 'View and manage all details of your client in one place.' : 'Create and set up a new client account.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link className="bp-btn bp-btn-outline" to="/admin/clients" style={{ fontSize: 12.5, borderRadius: 6 }}>Back to Clients</Link>
            {isEdit && (
              <button type="button" className="bp-btn bp-btn-outline" onClick={toggleStatus} style={{ fontSize: 12.5, borderRadius: 6 }}>
                {form.is_active ? 'Mark Inactive' : 'Mark Active'}
              </button>
            )}
          </div>
        </div>
      </div>

      {err && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {err}
        </div>
      )}

      {/* Persistent Client Header (Module 2A - Section A) */}
      {isEdit && (
        <div
          className="bp-card bp-client-header-card"
          style={{
            marginBottom: 16,
            padding: '14px 20px',
            background: '#ffffff',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            {/* Left side: Light-blue container + Deep blue building icon + Name + Client ID & Active pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: '#eff6ff',
                  border: '1px solid #dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1e40af',
                  flexShrink: 0,
                }}
              >
                <BuildingIcon color="#1e40af" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: '#1e3a8a' }}>
                  {form.client_name || form.business_name || 'Client Name'}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: '#64748b' }}>
                    Client ID: {form.client_code || '—'}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '1px 8px',
                      borderRadius: 999,
                      background: form.is_active ? '#dcfce7' : '#fee2e2',
                      color: form.is_active ? '#15803d' : '#dc2626',
                    }}
                  >
                    {form.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right side: 5 metadata columns with vertical dividers */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ padding: '0 18px', borderRight: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Constitution</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e3a8a', marginTop: 3, whiteSpace: 'nowrap' }}>
                  {form.constitution_type || '—'}
                </div>
              </div>
              <div style={{ padding: '0 18px', borderRight: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>GSTIN</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e3a8a', marginTop: 3, whiteSpace: 'nowrap' }}>
                  {form.gstin || (form.has_gst ? '—' : 'Unregistered')}
                </div>
              </div>
              <div style={{ padding: '0 18px', borderRight: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Mobile</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e3a8a', marginTop: 3, whiteSpace: 'nowrap' }}>
                  {form.mobile || '—'}
                </div>
              </div>
              <div style={{ padding: '0 18px', borderRight: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Email</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e3a8a', marginTop: 3, whiteSpace: 'nowrap' }}>
                  {form.email || '—'}
                </div>
              </div>
              <div style={{ padding: '0 0 0 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Last Updated</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e3a8a', marginTop: 3, whiteSpace: 'nowrap' }}>
                  {formatLastUpdated(form.updated_at)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10-Tab Bar: 10 equal columns grid matching PDF */}
      <div
        className="cp-tabs"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(10, minmax(75px, 1fr))',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          marginBottom: 16,
        }}
      >
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`cp-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(t.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 4px 8px',
                minHeight: 68,
                borderRadius: 6,
                fontSize: 11,
                fontWeight: isActive ? 600 : 500,
                textAlign: 'center',
                lineHeight: 1.25,
                background: isActive ? '#edf5fd' : '#ffffff',
                color: isActive ? '#2563eb' : '#475569',
                border: isActive ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <TabIcon name={t.icon} active={isActive} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Card */}
      <div className="bp-card" style={{ padding: 24, background: '#ffffff', borderRadius: 12, border: '1px solid var(--bp-border, #e2e8f0)' }}>
        {/* Tab 1: Personal Information */}
        {tab === 'personal' && (
          <div>
            {/* Tab Header inside Card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1d4ed8' }}>
                  Personal Information
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                  Manage contact person details, address, mobile, email and other personal information.
                </p>
              </div>
            </div>

            {/* Section 1: Contact Person Details (4-column grid) */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
                  Contact Person Details
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px 16px' }}>
                <Field label="Contact Person Name" required>
                  <input
                    className="bp-input"
                    required
                    disabled={!isEditing}
                    value={form.contact_person_name}
                    onChange={(e) => set('contact_person_name', e.target.value)}
                    placeholder="e.g. Mohammed Ahmed Khan"
                  />
                </Field>
                <Field label="Designation">
                  <input
                    className="bp-input"
                    disabled={!isEditing}
                    value={form.designation}
                    onChange={(e) => set('designation', e.target.value)}
                    placeholder="e.g. Director"
                  />
                </Field>
                <Field label="Mobile Number" required>
                  <input
                    className="bp-input"
                    required
                    disabled={!isEditing}
                    value={form.mobile}
                    onChange={(e) => set('mobile', e.target.value)}
                    placeholder="10-digit mobile number"
                  />
                </Field>
                <Field label="Alternate Mobile">
                  <input
                    className="bp-input"
                    disabled={!isEditing}
                    value={form.alt_mobile}
                    onChange={(e) => set('alt_mobile', e.target.value)}
                    placeholder="Alternate contact number"
                  />
                </Field>

                <Field label="Email Address" required>
                  <input
                    className="bp-input"
                    type="email"
                    required
                    disabled={!isEditing}
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="primary@company.com"
                  />
                </Field>
                <Field label="Alternate Email">
                  <input
                    className="bp-input"
                    type="email"
                    disabled={!isEditing}
                    value={form.alt_email}
                    onChange={(e) => set('alt_email', e.target.value)}
                    placeholder="alternate@company.com"
                  />
                </Field>
                <Field label="Date of Birth">
                  <input
                    className="bp-input"
                    type="date"
                    disabled={!isEditing}
                    value={form.date_of_birth || ''}
                    onChange={(e) => set('date_of_birth', e.target.value)}
                  />
                </Field>
                <Field label="Gender">
                  <select
                    className="bp-select"
                    disabled={!isEditing}
                    value={form.gender || ''}
                    onChange={(e) => set('gender', e.target.value)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Section 2: Address Details (Split layout: Left ~62%, Right ~38%) */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
                  Address Details
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
                {/* Left side: Registered Office Address */}
                <div>
                  <AddressFields
                    values={form}
                    onChange={(k, v) => set(k, v)}
                    onBatchChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
                    disabled={!isEditing}
                  />
                </div>

                {/* Right side: Communication Address Card */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: '#2563eb' }}>
                      Communication Address
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 500, color: '#475569', cursor: isEditing ? 'pointer' : 'default' }}>
                      <input
                        type="checkbox"
                        disabled={!isEditing}
                        checked={!!form.comm_same_as_above}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked && !form.comm_address_line_1) {
                            setForm((f) => ({
                              ...f,
                              comm_same_as_above: false,
                              comm_address_line_1: f.address_line_1 || '',
                              comm_address_line_2: f.address_line_2 || '',
                              comm_city: f.city || '',
                              comm_state: f.state || '',
                              comm_state_code: f.state_code || '27',
                              comm_pincode: f.pincode || '',
                              comm_country: f.country || 'India',
                            }));
                          } else {
                            set('comm_same_as_above', checked);
                          }
                        }}
                        style={{ width: 15, height: 15, accentColor: '#2563eb', cursor: isEditing ? 'pointer' : 'default' }}
                      />
                      Same as above
                    </label>
                  </div>

                  {form.comm_same_as_above ? (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        padding: '12px 14px',
                        fontSize: 12,
                        color: '#475569',
                        lineHeight: 1.6,
                        minHeight: 120,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                        {form.address_line_1 || '(Same as Registered Address)'}
                      </div>
                      {form.address_line_2 && <div>{form.address_line_2}</div>}
                      <div>
                        {[form.city, form.pincode ? form.pincode : ''].filter(Boolean).join(' - ') || '—'}
                      </div>
                      <div>
                        {[form.state, form.country || 'India'].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  ) : (
                    <AddressFields
                      values={form}
                      prefix="comm_"
                      onChange={(k, v) => set(k, v)}
                      onBatchChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
                      disabled={!isEditing}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Other Information */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
                    Other Information
                  </span>
                </div>
                {isEdit ? (
                  <button
                    type="button"
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '5px 14px',
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setSelectedEditInfo(null);
                      setShowAddInfoModal(true);
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>+</span> Add
                  </button>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--bp-muted, #64748b)', fontStyle: 'italic' }}>
                    (Save client profile first to add records)
                  </span>
                )}
              </div>

              {/* Information Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 12px', width: 50, fontWeight: 600, color: '#475569', fontSize: 11.5 }}>S.No</th>
                      <th style={{ padding: '8px 12px', width: 200, fontWeight: 600, color: '#475569', fontSize: 11.5 }}>Information Type</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', fontSize: 11.5 }}>Remarks</th>
                      <th style={{ padding: '8px 12px', width: 120, fontWeight: 600, color: '#475569', fontSize: 11.5 }}>Updated On</th>
                      <th style={{ padding: '8px 12px', width: 80, fontWeight: 600, color: '#475569', fontSize: 11.5, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {additionalInfos.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8' }}>
                          No additional information records found.
                        </td>
                      </tr>
                    ) : (
                      additionalInfos.map((info, idx) => (
                        <tr key={info.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '9px 12px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e40af' }}>
                            {info.information}
                          </td>
                          <td style={{ padding: '9px 12px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                            {info.remarks}
                          </td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 11.5 }}>
                            {formatLastUpdated(info.updated_at || info.created_at)}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => {
                                  setSelectedEditInfo(info);
                                  setShowAddInfoModal(true);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#2563eb',
                                  padding: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Delete"
                                onClick={() => handleDeleteInfo(info.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#ef4444',
                                  padding: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Business Information */}
        {tab === 'business' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1d4ed8', marginBottom: 16 }}>
              Business Details
            </h3>
            <div className="cp-grid">
              <Field label="Business Name">
                <input
                  className="bp-input"
                  disabled={!isEditing}
                  value={form.business_name}
                  onChange={(e) => set('business_name', e.target.value)}
                />
              </Field>
              <Field label="Constitution Type">
                <select
                  className="bp-select"
                  disabled={!isEditing}
                  value={form.constitution_type}
                  onChange={(e) => set('constitution_type', e.target.value)}
                >
                  <option value="">Select</option>
                  {CONSTITUTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Business Type">
                <input
                  className="bp-input"
                  disabled={!isEditing}
                  value={form.business_type}
                  onChange={(e) => set('business_type', e.target.value)}
                />
              </Field>
              <Field label="Date of Incorporation">
                <input
                  className="bp-input"
                  type="date"
                  disabled={!isEditing}
                  value={form.date_of_incorporation || ''}
                  onChange={(e) => set('date_of_incorporation', e.target.value)}
                />
              </Field>
              <Field label="Website">
                <input
                  className="bp-input"
                  disabled={!isEditing}
                  value={form.website}
                  onChange={(e) => set('website', e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Tab 3: Registration & Compliance */}
        {tab === 'registration' && (
          <div>
            {/* Tab Header Banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1d4ed8' }}>
                  Registration & Compliance Details
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                  Manage PAN, GST, TAN, CIN, UDYAM, Shop Act, FSSAI, IEC, PTRC, PTEC and other registrations.
                </p>
              </div>
            </div>

            {/* 3-Column Grid of Modular Registration Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
              {/* Card 1: PAN Details */}
              <RegCard
                title="PAN Details"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                }
                enabled={form.pan_enabled}
                onToggle={() => set('pan_enabled', !form.pan_enabled)}
                isEditing={isEditing}
              >
                <CompactField label="PAN" required>
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5, textTransform: 'uppercase' }}
                    maxLength={10}
                    disabled={!isEditing || !form.pan_enabled}
                    value={form.pan}
                    onChange={(e) => set('pan', e.target.value.toUpperCase())}
                    placeholder="e.g. AACCB1234A"
                  />
                </CompactField>
                <CompactField label="PAN Status" required>
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.pan_enabled}
                    value={form.pan_status || 'Active'}
                    onChange={(e) => set('pan_status', e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </CompactField>
                <CompactField label="Name as per PAN" required full>
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.pan_enabled}
                    value={form.name_as_per_pan || form.client_name}
                    onChange={(e) => set('name_as_per_pan', e.target.value)}
                    placeholder="e.g. ABC Private Limited"
                  />
                </CompactField>
                <CompactField label="Date of Allotment" full>
                  <input
                    type="date"
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.pan_enabled}
                    value={form.pan_allotment_date || ''}
                    onChange={(e) => set('pan_allotment_date', e.target.value)}
                  />
                </CompactField>
              </RegCard>

              {/* Card 2: GST Registration Details */}
              <RegCard
                title="GST Registration Details"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                }
                enabled={form.gst_enabled}
                onToggle={() => {
                  const nextVal = !form.gst_enabled;
                  setForm((f) => ({ ...f, gst_enabled: nextVal, has_gst: nextVal }));
                }}
                isEditing={isEditing}
              >
                <CompactField label="GSTIN" required>
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5, textTransform: 'uppercase' }}
                    maxLength={15}
                    disabled={!isEditing || !form.gst_enabled}
                    value={form.gstin}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      set('gstin', val);
                      if (val.length >= 2) {
                        const code = val.slice(0, 2);
                        const s = STATE_CODE_LIST.find((st) => st.code === code);
                        if (s && s.name !== form.state) {
                          setForm((f) => ({ ...f, gstin: val, state: s.name, state_code: code }));
                        }
                      }
                    }}
                    placeholder="27AACCB1234A1Z5"
                  />
                </CompactField>
                <CompactField label="Registration Type" required>
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.gst_enabled}
                    value={form.registration_type || 'Regular'}
                    onChange={(e) => {
                      const nextReg = e.target.value;
                      const isComp = nextReg === 'Composition';
                      setForm((f) => ({
                        ...f,
                        registration_type: nextReg,
                        dealer_type: isComp ? 'composition' : 'regular',
                        opt_out: isComp ? 'Quarterly' : (f.opt_out || 'Monthly'),
                        gst_filing_frequency: isComp ? 'quarterly' : (f.opt_out === 'Quarterly' ? 'quarterly' : 'monthly'),
                        gstr1_filing_frequency: isComp ? '' : 'monthly',
                        gstr2b_filing_frequency: isComp ? '' : (f.opt_out === 'Quarterly' ? 'quarterly' : 'monthly'),
                      }));
                    }}
                  >
                    <option value="Regular">Regular</option>
                    <option value="Composition">Composition</option>
                  </select>
                </CompactField>
                <CompactField label="GST Status" required>
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.gst_enabled}
                    value={form.gst_status || 'Active'}
                    onChange={(e) => set('gst_status', e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </CompactField>
                <CompactField label="Date of Registration" required>
                  <input
                    type="date"
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.gst_enabled}
                    value={form.gst_registration_date || ''}
                    onChange={(e) => set('gst_registration_date', e.target.value)}
                  />
                </CompactField>
                <CompactField label="State Jurisdiction" required full>
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.gst_enabled}
                    value={form.state_jurisdiction || ''}
                    onChange={(e) => set('state_jurisdiction', e.target.value)}
                    placeholder="e.g. Navi Mumbai"
                  />
                </CompactField>
              </RegCard>

              {/* Card 3: TAN Details */}
              <RegCard
                title="TAN Details"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                }
                enabled={form.tan_enabled}
                onToggle={() => set('tan_enabled', !form.tan_enabled)}
                isEditing={isEditing}
              >
                <CompactField label="TAN" required>
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5, textTransform: 'uppercase' }}
                    maxLength={10}
                    disabled={!isEditing || !form.tan_enabled}
                    value={form.tan}
                    onChange={(e) => set('tan', e.target.value.toUpperCase())}
                    placeholder="e.g. MUMA12345E"
                  />
                </CompactField>
                <CompactField label="TAN Status" required>
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.tan_enabled}
                    value={form.tan_status || 'Active'}
                    onChange={(e) => set('tan_status', e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </CompactField>
                <CompactField label="Date of Allotment" full>
                  <input
                    type="date"
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.tan_enabled}
                    value={form.tan_allotment_date || ''}
                    onChange={(e) => set('tan_allotment_date', e.target.value)}
                  />
                </CompactField>
              </RegCard>

              {/* Card 4: CIN Details */}
              <RegCard
                title="CIN Details"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                }
                enabled={form.cin_enabled}
                onToggle={() => set('cin_enabled', !form.cin_enabled)}
                isEditing={isEditing}
              >
                <CompactField label="CIN (Corporate Identification Number)" required full>
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5, textTransform: 'uppercase' }}
                    maxLength={21}
                    disabled={!isEditing || !form.cin_enabled}
                    value={form.cin}
                    onChange={(e) => set('cin', e.target.value.toUpperCase())}
                    placeholder="e.g. U74999MH2022PTC123456"
                  />
                </CompactField>
                <CompactField label="Date of Incorporation" required>
                  <input
                    type="date"
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.cin_enabled}
                    value={form.cin_incorporation_date || form.date_of_incorporation || ''}
                    onChange={(e) => set('cin_incorporation_date', e.target.value)}
                  />
                </CompactField>
                <CompactField label="Place of Incorporation">
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.cin_enabled}
                    value={form.cin_incorporation_place || ''}
                    onChange={(e) => set('cin_incorporation_place', e.target.value)}
                    placeholder="e.g. Mumbai"
                  />
                </CompactField>
                <CompactField label="Certificate of Incorporation (No.)" full>
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.cin_enabled}
                    value={form.cin_certificate_no || ''}
                    onChange={(e) => set('cin_certificate_no', e.target.value)}
                    placeholder="e.g. CIN1234562022"
                  />
                </CompactField>
              </RegCard>

              {/* Card 5: UDYAM Registration */}
              <RegCard
                title="UDYAM Registration"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="6" />
                    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                  </svg>
                }
                enabled={form.udyam_enabled}
                onToggle={() => set('udyam_enabled', !form.udyam_enabled)}
                isEditing={isEditing}
              >
                <CompactField label="UDYAM Number" required>
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5, textTransform: 'uppercase' }}
                    disabled={!isEditing || !form.udyam_enabled}
                    value={form.udyam}
                    onChange={(e) => set('udyam', e.target.value.toUpperCase())}
                    placeholder="UDYAM-MH-27-1234567"
                  />
                </CompactField>
                <CompactField label="Type of Enterprise" required>
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.udyam_enabled}
                    value={form.udyam_enterprise_type || 'Micro'}
                    onChange={(e) => set('udyam_enterprise_type', e.target.value)}
                  >
                    <option value="Micro">Micro</option>
                    <option value="Small">Small</option>
                    <option value="Medium">Medium</option>
                  </select>
                </CompactField>
                <CompactField label="Date of Registration" required>
                  <input
                    type="date"
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.udyam_enabled}
                    value={form.udyam_registration_date || ''}
                    onChange={(e) => set('udyam_registration_date', e.target.value)}
                  />
                </CompactField>
                <CompactField label="Status" required>
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.udyam_enabled}
                    value={form.udyam_status || 'Active'}
                    onChange={(e) => set('udyam_status', e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </CompactField>
              </RegCard>

              {/* Card 6: Shop & Establishment */}
              <RegCard
                title="Shop & Establishment"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
                    <path d="M2 7h20" />
                  </svg>
                }
                enabled={form.shop_act_enabled}
                onToggle={() => set('shop_act_enabled', !form.shop_act_enabled)}
                isEditing={isEditing}
              >
                <CompactField label="Shop Act Number">
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.shop_act_enabled}
                    value={form.shop_establishment}
                    onChange={(e) => set('shop_establishment', e.target.value)}
                    placeholder="MH/NM/2022/012345"
                  />
                </CompactField>
                <CompactField label="Issuing Authority">
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.shop_act_enabled}
                    value={form.shop_act_issuing_authority || ''}
                    onChange={(e) => set('shop_act_issuing_authority', e.target.value)}
                    placeholder="Navi Mumbai Municipal Corp"
                  />
                </CompactField>
                <CompactField label="Date of Registration">
                  <input
                    type="date"
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.shop_act_enabled}
                    value={form.shop_act_registration_date || ''}
                    onChange={(e) => set('shop_act_registration_date', e.target.value)}
                  />
                </CompactField>
                <CompactField label="Status">
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.shop_act_enabled}
                    value={form.shop_act_status || 'Inactive'}
                    onChange={(e) => set('shop_act_status', e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </CompactField>
              </RegCard>

              {/* Card 7: FSSAI Registration */}
              <RegCard
                title="FSSAI Registration"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                }
                enabled={form.fssai_enabled}
                onToggle={() => set('fssai_enabled', !form.fssai_enabled)}
                isEditing={isEditing}
              >
                <CompactField label="FSSAI Number" required>
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.fssai_enabled}
                    value={form.fssai_no || ''}
                    onChange={(e) => set('fssai_no', e.target.value)}
                    placeholder="11522019000023"
                  />
                </CompactField>
                <CompactField label="License Type">
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.fssai_enabled}
                    value={form.fssai_license_type || 'Basic'}
                    onChange={(e) => set('fssai_license_type', e.target.value)}
                  >
                    <option value="Basic">Basic</option>
                    <option value="State">State</option>
                    <option value="Central">Central</option>
                  </select>
                </CompactField>
                <CompactField label="Date of Registration">
                  <input
                    type="date"
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.fssai_enabled}
                    value={form.fssai_registration_date || ''}
                    onChange={(e) => set('fssai_registration_date', e.target.value)}
                  />
                </CompactField>
                <CompactField label="Status" required>
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.fssai_enabled}
                    value={form.fssai_status || 'Active'}
                    onChange={(e) => set('fssai_status', e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </CompactField>
              </RegCard>

              {/* Card 8: IEC (Import Export Code) */}
              <RegCard
                title="IEC (Import Export Code)"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                }
                enabled={form.iec_enabled}
                onToggle={() => set('iec_enabled', !form.iec_enabled)}
                isEditing={isEditing}
              >
                <CompactField label="IEC Number">
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5, textTransform: 'uppercase' }}
                    maxLength={10}
                    disabled={!isEditing || !form.iec_enabled}
                    value={form.iec}
                    onChange={(e) => set('iec', e.target.value.toUpperCase())}
                    placeholder="AACCB1234A"
                  />
                </CompactField>
                <CompactField label="Date of Registration">
                  <input
                    type="date"
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.iec_enabled}
                    value={form.iec_registration_date || ''}
                    onChange={(e) => set('iec_registration_date', e.target.value)}
                  />
                </CompactField>
                <CompactField label="Status" full>
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.iec_enabled}
                    value={form.iec_status || 'Inactive'}
                    onChange={(e) => set('iec_status', e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </CompactField>
              </RegCard>

              {/* Card 9: PTRC (Professional Tax) */}
              <RegCard
                title="PTRC (Professional Tax)"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
                enabled={form.ptrc_enabled}
                onToggle={() => set('ptrc_enabled', !form.ptrc_enabled)}
                isEditing={isEditing}
              >
                <CompactField label="PTRC Number">
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5, textTransform: 'uppercase' }}
                    disabled={!isEditing || !form.ptrc_enabled}
                    value={form.pt_reg}
                    onChange={(e) => set('pt_reg', e.target.value.toUpperCase())}
                    placeholder="27122012345P"
                  />
                </CompactField>
                <CompactField label="State" required>
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.ptrc_enabled}
                    value={form.ptrc_state || 'Maharashtra'}
                    onChange={(e) => set('ptrc_state', e.target.value)}
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </CompactField>
                <CompactField label="Date of Registration">
                  <input
                    type="date"
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.ptrc_enabled}
                    value={form.ptrc_registration_date || ''}
                    onChange={(e) => set('ptrc_registration_date', e.target.value)}
                  />
                </CompactField>
                <CompactField label="Status">
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.ptrc_enabled}
                    value={form.ptrc_status || 'Active'}
                    onChange={(e) => set('ptrc_status', e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </CompactField>
              </RegCard>

              {/* Card 10: PTEC (Professional Tax Enrollment) */}
              <RegCard
                title="PTEC (Professional Tax Enrollment)"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <polyline points="17 11 19 13 23 9" />
                  </svg>
                }
                enabled={form.ptec_enabled}
                onToggle={() => set('ptec_enabled', !form.ptec_enabled)}
                isEditing={isEditing}
              >
                <CompactField label="PTEC Number" required>
                  <input
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5, textTransform: 'uppercase' }}
                    disabled={!isEditing || !form.ptec_enabled}
                    value={form.ptec_no || ''}
                    onChange={(e) => set('ptec_no', e.target.value.toUpperCase())}
                    placeholder="27122012345E"
                  />
                </CompactField>
                <CompactField label="State" required>
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.ptec_enabled}
                    value={form.ptec_state || 'Maharashtra'}
                    onChange={(e) => set('ptec_state', e.target.value)}
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </CompactField>
                <CompactField label="Date of Registration">
                  <input
                    type="date"
                    className="bp-input"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.ptec_enabled}
                    value={form.ptec_registration_date || ''}
                    onChange={(e) => set('ptec_registration_date', e.target.value)}
                  />
                </CompactField>
                <CompactField label="Status" required>
                  <select
                    className="bp-select"
                    style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                    disabled={!isEditing || !form.ptec_enabled}
                    value={form.ptec_status || 'Active'}
                    onChange={(e) => set('ptec_status', e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </CompactField>
              </RegCard>

              {/* Card 11: Portal Credentials (Spans 2 columns) */}
              <div
                style={{
                  gridColumn: 'span 2',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '14px 16px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 12,
                      paddingBottom: 8,
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>Portal Credentials</span>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px', fontWeight: 600, width: '22%' }}>Portal / Service</th>
                        <th style={{ padding: '6px 8px', fontWeight: 600, width: '38%' }}>Portal User ID</th>
                        <th style={{ padding: '6px 8px', fontWeight: 600, width: '25%' }}>Portal Password *</th>
                        <th style={{ padding: '6px 8px', fontWeight: 600, width: '15%' }}>Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* GST Portal */}
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', fontWeight: 600, color: '#1e3a8a' }}>GST Portal</td>
                        <td style={{ padding: '8px' }}>
                          <input
                            className="bp-input"
                            disabled={!isEditing}
                            style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                            value={form.gst_portal_username || ''}
                            onChange={(e) => set('gst_portal_username', e.target.value)}
                            placeholder="GST Portal Username"
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <PasswordField
                            label=""
                            disabled={!isEditing}
                            value={form.gst_portal_password || ''}
                            onChange={(e) => set('gst_portal_password', e.target.value)}
                            autoComplete="new-password"
                          />
                        </td>
                        <td style={{ padding: '8px', color: '#64748b', fontSize: 11.5 }}>
                          {formatLastUpdated(form.updated_at)}
                        </td>
                      </tr>

                      {/* TAN Portal */}
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', fontWeight: 600, color: '#1e3a8a' }}>TAN Portal</td>
                        <td style={{ padding: '8px' }}>
                          <input
                            className="bp-input"
                            disabled={!isEditing}
                            style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                            value={form.tan_portal_username || ''}
                            onChange={(e) => set('tan_portal_username', e.target.value)}
                            placeholder="TAN Portal User ID"
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <PasswordField
                            label=""
                            disabled={!isEditing}
                            value={form.tan_portal_password || ''}
                            onChange={(e) => set('tan_portal_password', e.target.value)}
                            autoComplete="new-password"
                          />
                        </td>
                        <td style={{ padding: '8px', color: '#64748b', fontSize: 11.5 }}>
                          {formatLastUpdated(form.updated_at)}
                        </td>
                      </tr>

                      {/* Income Tax Portal */}
                      <tr>
                        <td style={{ padding: '8px', fontWeight: 600, color: '#1e3a8a' }}>Income Tax Portal</td>
                        <td style={{ padding: '8px' }}>
                          <input
                            className="bp-input"
                            disabled={!isEditing}
                            style={{ height: 32, fontSize: 12, padding: '4px 8px', borderRadius: 5 }}
                            value={form.it_portal_username || ''}
                            onChange={(e) => set('it_portal_username', e.target.value)}
                            placeholder="IT Portal User ID / PAN"
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <PasswordField
                            label=""
                            disabled={!isEditing}
                            value={form.it_portal_password || ''}
                            onChange={(e) => set('it_portal_password', e.target.value)}
                            autoComplete="new-password"
                          />
                        </td>
                        <td style={{ padding: '8px', color: '#64748b', fontSize: 11.5 }}>
                          {formatLastUpdated(form.updated_at)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Other Information Table Section */}
            <div style={{ marginTop: 24, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
                    Other Information
                  </span>
                </div>
                {isEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEditInfo(null);
                      setShowAddInfoModal(true);
                    }}
                    style={{
                      background: '#2563eb',
                      border: 'none',
                      color: '#ffffff',
                      padding: '5px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>+</span> Add
                  </button>
                )}
              </div>

              {/* Other Information Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '9px 12px', width: 60, fontWeight: 600 }}>S. No.</th>
                      <th style={{ padding: '9px 12px', width: 220, fontWeight: 600 }}>Information Type</th>
                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Remarks</th>
                      <th style={{ padding: '9px 12px', width: 140, fontWeight: 600 }}>Updated On</th>
                      <th style={{ padding: '9px 12px', width: 90, fontWeight: 600, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {additionalInfos.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                          No additional information records added yet. Click &ldquo;+ Add&rdquo; above to record extra client details.
                        </td>
                      </tr>
                    ) : (
                      additionalInfos.map((info, idx) => (
                        <tr key={info.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '9px 12px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e40af' }}>
                            {info.information}
                          </td>
                          <td style={{ padding: '9px 12px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                            {info.remarks}
                          </td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 11.5 }}>
                            {formatLastUpdated(info.updated_at || info.created_at)}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => {
                                  setSelectedEditInfo(info);
                                  setShowAddInfoModal(true);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#2563eb',
                                  padding: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Delete"
                                onClick={() => handleDeleteInfo(info.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#ef4444',
                                  padding: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Bank Account Details */}
        {tab === 'bank' && (
          <div>
            {/* Header Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                marginBottom: 20,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1d4ed8',
                    flexShrink: 0,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="10" width="18" height="11" rx="1" />
                    <path d="M12 3 2 9h20L12 3z" />
                    <path d="M7 14v4" />
                    <path d="M12 14v4" />
                    <path d="M17 14v4" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1d4ed8' }}>
                    Bank Account Details
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
                    Manage bank accounts used for invoices, payments and other business transactions.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowBankForm(true);
                  resetBankForm();
                  setTimeout(() => {
                    const el = document.getElementById('bank-form-card');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    document.getElementById('bank-name-input')?.focus();
                  }, 60);
                }}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1d4ed8')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#2563eb')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Bank Account
              </button>
            </div>

            {/* Section 1: Bank Accounts Table Card */}
            <div
              id="bank-accounts-table-card"
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                marginBottom: 20,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                overflow: 'hidden',
              }}
            >
              {bankSuccessMsg && (
                <div
                  style={{
                    margin: '14px 20px 0',
                    padding: '10px 14px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 6,
                    color: '#15803d',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {bankSuccessMsg}
                </div>
              )}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1e293b' }}>
                  Bank Accounts
                </h4>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Total: {bankAccounts.length} account{bankAccounts.length === 1 ? '' : 's'}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '10px 14px', width: 45, fontWeight: 600, textAlign: 'center' }}>#</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Bank Name</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Account Holder Name</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Account Number</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>IFSC Code</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Branch</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Account Type</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'center' }}>Primary</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'center', width: 100 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: '28px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                          No bank accounts recorded yet. Fill the form below or click &ldquo;+ Add Bank Account&rdquo; to add one.
                        </td>
                      </tr>
                    ) : (
                      bankAccounts.map((acc, idx) => (
                        <tr key={acc.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e40af' }}>
                            {acc.bank_name}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#334155' }}>
                            {acc.account_holder_name || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                            {acc.account_number}
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#1e40af' }}>
                            {acc.ifsc_code}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>
                            {acc.branch || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#334155' }}>
                            {acc.account_type || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {acc.is_primary ? (
                              <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
                                Yes
                              </span>
                            ) : (
                              <span style={{ background: '#f1f5f9', color: '#64748b', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, display: 'inline-block' }}>
                                No
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {acc.status === 'Active' ? (
                              <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
                                Active
                              </span>
                            ) : (
                              <span style={{ background: '#fee2e2', color: '#dc2626', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
                                Inactive
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
                              <button
                                type="button"
                                title="Edit Account"
                                onClick={() => handleEditBankAccount(acc)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#2563eb',
                                  padding: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Delete Account"
                                onClick={() => handleDeleteBankAccount(acc.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#ef4444',
                                  padding: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2: Add / Edit Bank Account Box */}
            {showBankForm ? (
              <div
                id="bank-form-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '20px 24px',
                  marginBottom: 20,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                      {bankForm.id ? 'Edit Bank Account' : 'Add / Edit Bank Account'}
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
                      Enter banking details below. Marking as Primary will use this account for client invoices and receipts.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {bankForm.id && (
                      <button
                        type="button"
                        onClick={resetBankForm}
                        style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        + Switch to New Account
                      </button>
                    )}
                    {bankAccounts.length > 0 && (
                      <button
                        type="button"
                        title="Close form"
                        onClick={handleCancelBankForm}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 1: 4 columns */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <label style={{ display: 'block' }}>
                    <div style={{ marginBottom: 5, fontSize: 12.5, fontWeight: 500, color: '#475569' }}>
                      Bank Name <span style={{ color: '#ef4444' }}>*</span>
                    </div>
                    <input
                      id="bank-name-input"
                      className="bp-input"
                      value={bankForm.bank_name}
                      onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                      placeholder="e.g. HDFC Bank"
                    />
                  </label>

                  <label style={{ display: 'block' }}>
                    <div style={{ marginBottom: 5, fontSize: 12.5, fontWeight: 500, color: '#475569' }}>
                      Account Holder Name <span style={{ color: '#ef4444' }}>*</span>
                    </div>
                    <input
                      className="bp-input"
                      value={bankForm.account_holder_name}
                      onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                      placeholder="e.g. Acme Technologies Pvt Ltd"
                    />
                  </label>

                  <label style={{ display: 'block' }}>
                    <div style={{ marginBottom: 5, fontSize: 12.5, fontWeight: 500, color: '#475569' }}>
                      Account Number <span style={{ color: '#ef4444' }}>*</span>
                    </div>
                    <input
                      className="bp-input"
                      value={bankForm.account_number}
                      onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                      placeholder="Enter account number"
                    />
                  </label>

                  <label style={{ display: 'block' }}>
                    <div style={{ marginBottom: 5, fontSize: 12.5, fontWeight: 500, color: '#475569' }}>
                      Confirm Account Number <span style={{ color: '#ef4444' }}>*</span>
                    </div>
                    <input
                      className="bp-input"
                      value={bankForm.confirm_account_number}
                      onChange={(e) => setBankForm({ ...bankForm, confirm_account_number: e.target.value })}
                      placeholder="Re-enter account number"
                    />
                  </label>
                </div>

                {/* Row 2: 4 columns */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <label style={{ display: 'block' }}>
                    <div style={{ marginBottom: 5, fontSize: 12.5, fontWeight: 500, color: '#475569' }}>
                      IFSC Code <span style={{ color: '#ef4444' }}>*</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        className="bp-input"
                        style={{ textTransform: 'uppercase', flex: '1 1 auto' }}
                        maxLength={11}
                        placeholder="e.g. HDFC0000123"
                        value={bankForm.ifsc_code}
                        onChange={(e) => {
                          setBankForm({ ...bankForm, ifsc_code: e.target.value.toUpperCase() });
                          setBankIfscNotice({ verifying: false, success: false, error: '', message: '' });
                        }}
                      />
                      <button
                        type="button"
                        disabled={bankIfscNotice.verifying || !bankForm.ifsc_code || bankForm.ifsc_code.trim().length !== 11}
                        onClick={handleVerifyBankFormIfsc}
                        style={{
                          padding: '7px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          flexShrink: 0,
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          cursor: (!bankForm.ifsc_code || bankForm.ifsc_code.trim().length !== 11) ? 'not-allowed' : 'pointer',
                          opacity: (!bankForm.ifsc_code || bankForm.ifsc_code.trim().length !== 11) ? 0.6 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {bankIfscNotice.verifying ? 'Verifying…' : 'Verify IFSC'}
                      </button>
                    </div>
                    {bankIfscNotice.success && (
                      <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>
                        ✓ {bankIfscNotice.message}
                      </div>
                    )}
                    {bankIfscNotice.error && (
                      <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 4 }}>
                        {bankIfscNotice.error}
                      </div>
                    )}
                  </label>

                  <label style={{ display: 'block' }}>
                    <div style={{ marginBottom: 5, fontSize: 12.5, fontWeight: 500, color: '#475569' }}>
                      Branch Name <span style={{ color: '#ef4444' }}>*</span>
                    </div>
                    <input
                      className="bp-input"
                      value={bankForm.branch}
                      onChange={(e) => setBankForm({ ...bankForm, branch: e.target.value })}
                      placeholder="e.g. Bandra Kurla Complex"
                    />
                  </label>

                  <label style={{ display: 'block' }}>
                    <div style={{ marginBottom: 5, fontSize: 12.5, fontWeight: 500, color: '#475569' }}>
                      Account Type <span style={{ color: '#ef4444' }}>*</span>
                    </div>
                    <select
                      className="bp-select"
                      value={bankForm.account_type}
                      onChange={(e) => setBankForm({ ...bankForm, account_type: e.target.value })}
                    >
                      <option value="Current Account">Current Account</option>
                      <option value="Savings Account">Savings Account</option>
                      <option value="Cash Credit">Cash Credit</option>
                      <option value="Overdraft">Overdraft</option>
                    </select>
                  </label>

                  <label style={{ display: 'block' }}>
                    <div style={{ marginBottom: 5, fontSize: 12.5, fontWeight: 500, color: '#475569' }}>
                      Set as Primary Account
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38 }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={bankForm.is_primary}
                        onClick={() => setBankForm({ ...bankForm, is_primary: !bankForm.is_primary })}
                        style={{
                          position: 'relative',
                          width: 44,
                          height: 24,
                          borderRadius: 12,
                          background: bankForm.is_primary ? '#2563eb' : '#cbd5e1',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'background 0.2s ease',
                          outline: 'none',
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: bankForm.is_primary ? 22 : 2,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            transition: 'left 0.2s ease',
                          }}
                        />
                      </button>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: bankForm.is_primary ? '#16a34a' : '#64748b' }}>
                        {bankForm.is_primary ? 'Primary (Default for invoices)' : 'Secondary'}
                      </span>
                    </div>
                  </label>
                </div>

                {/* Row 3: Remarks (Optional) full width */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block' }}>
                    <div style={{ marginBottom: 5, fontSize: 12.5, fontWeight: 500, color: '#475569' }}>
                      Remarks (Optional)
                    </div>
                    <input
                      className="bp-input"
                      value={bankForm.remarks}
                      onChange={(e) => setBankForm({ ...bankForm, remarks: e.target.value })}
                      placeholder="e.g. Primary operating account for GST invoicing and client collections"
                    />
                  </label>
                </div>

                {/* Additional International & UPI Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 16,
                    padding: '12px 14px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    marginTop: 12,
                  }}
                >
                  <label style={{ display: 'block' }}>
                    <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                      SWIFT Code (Optional for international banking)
                    </div>
                    <input
                      className="bp-input"
                      disabled={!isEditing}
                      style={{ textTransform: 'uppercase' }}
                      value={form.swift_code || ''}
                      onChange={(e) => set('swift_code', e.target.value.toUpperCase())}
                      placeholder="e.g. HDFCINBB"
                    />
                  </label>

                  <label style={{ display: 'block' }}>
                    <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                      UPI ID (Optional for QR code payments)
                    </div>
                    <input
                      className="bp-input"
                      disabled={!isEditing}
                      value={form.upi_id || ''}
                      onChange={(e) => set('upi_id', e.target.value)}
                      placeholder="e.g. company@okhdfcbank"
                    />
                  </label>
                </div>

                {/* Error Alert */}
                {bankFormErr && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      padding: '10px 14px',
                      borderRadius: 6,
                      fontSize: 12.5,
                      marginTop: 14,
                    }}
                  >
                    {bankFormErr}
                  </div>
                )}

                {/* Buttons Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button
                    type="button"
                    onClick={handleCancelBankForm}
                    style={{
                      padding: '8px 18px',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#475569',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingBank}
                    onClick={handleSaveBankAccount}
                    style={{
                      padding: '8px 22px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#ffffff',
                      background: '#2563eb',
                      border: 'none',
                      borderRadius: 6,
                      cursor: savingBank ? 'not-allowed' : 'pointer',
                      boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {savingBank ? 'Saving…' : (bankForm.id ? 'Update Bank Account' : 'Save Bank Account')}
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: 8,
                  padding: '20px',
                  textAlign: 'center',
                  marginBottom: 20,
                }}
              >
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>
                  Click below to record an additional bank account.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowBankForm(true);
                    resetBankForm();
                    setTimeout(() => {
                      document.getElementById('bank-form-card')?.scrollIntoView({ behavior: 'smooth' });
                      document.getElementById('bank-name-input')?.focus();
                    }, 50);
                  }}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  + Add Bank Account
                </button>
              </div>
            )}

            <p style={{ color: 'var(--bp-muted)', fontSize: 12.5, margin: '12px 0 0' }}>
              Logo, signature, seal, and QR code are managed by the client via Settings and appear here only after you approve a change request.
            </p>
          </div>
        )}

        {/* Tab 5: Document Numbering */}
        {tab === 'numbering' && (
          <div>
            {/* Header Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                marginBottom: '20px',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#f43f5e',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(244, 63, 94, 0.35)',
                    flexShrink: 0,
                  }}
                >
                  #
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                    Document Numbering
                  </h2>
                  <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Set and manage prefixes, numbering and format for all billing and other documents.
                  </p>
                </div>
              </div>

              {/* Top Right Notice Callout */}
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '9px 15px',
                  maxWidth: '520px',
                  fontSize: '11.5px',
                  color: '#1e40af',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '2px' }}>
                  <span>•</span>
                  <span>You can set automatic numbering or allow manual numbering for each document type.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span>•</span>
                  <span>You can enter any separator between prefix and number (e.g. -, /, space etc.).</span>
                </div>
              </div>
            </div>

            {/* Main Content: Left 10-Column Table + Right Format Preview */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Left: Document Types Table */}
              <div
                style={{
                  flex: '1 1 720px',
                  minWidth: 0,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: '34px' }}>#</th>
                        <th style={{ padding: '10px 10px', minWidth: '120px' }}>Document Type</th>
                        <th style={{ padding: '10px 8px', minWidth: '70px', textAlign: 'center' }}>Prefix</th>
                        <th style={{ padding: '10px 6px', minWidth: '60px', textAlign: 'center' }}>Separator</th>
                        <th style={{ padding: '10px 8px', minWidth: '70px', textAlign: 'center' }}>Next Number</th>
                        <th style={{ padding: '10px 10px', minWidth: '115px' }}>Prefix Position</th>
                        <th style={{ padding: '10px 10px', minWidth: '95px' }}>Numbering Type</th>
                        <th style={{ padding: '10px 8px', minWidth: '110px', textAlign: 'center' }}>Number Format (Preview)</th>
                        <th style={{ padding: '10px 8px', minWidth: '60px', textAlign: 'center' }}>Status</th>
                        <th style={{ padding: '10px 10px', minWidth: '100px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DOCUMENT_NUMBERING_TYPES.map((doc, idx) => {
                        const cfg = form.document_numbering_settings?.[doc.key] || {
                          prefix: doc.defaultPrefix,
                          separator: doc.defaultSep,
                          next_number: doc.defaultNext,
                          prefix_position: 'first',
                          numbering_type: 'auto',
                          status: true,
                        };
                        const previewVal = formatDocNumber(cfg);
                        const isSelected = selectedPreviewDoc === doc.key;

                        return (
                          <tr
                            key={doc.key}
                            style={{
                              borderBottom: idx === DOCUMENT_NUMBERING_TYPES.length - 1 ? 'none' : '1px solid #f1f5f9',
                              background: isSelected ? '#f8faff' : '#ffffff',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            {/* # */}
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b', fontWeight: 500 }}>
                              {idx + 1}
                            </td>

                            {/* Document Type */}
                            <td style={{ padding: '10px 10px' }}>
                              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                {doc.label}
                              </span>
                            </td>

                            {/* Prefix */}
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <input
                                className="bp-input"
                                disabled={!isEditing}
                                value={cfg.prefix || ''}
                                placeholder={doc.defaultPrefix}
                                onChange={(e) => updateDocNumberingField(doc.key, 'prefix', e.target.value)}
                                style={{
                                  width: '60px',
                                  padding: '5px 6px',
                                  fontSize: '12px',
                                  textAlign: 'center',
                                  fontWeight: 600,
                                }}
                              />
                            </td>

                            {/* Separator */}
                            <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                              <input
                                className="bp-input"
                                disabled={!isEditing}
                                value={cfg.separator ?? ''}
                                placeholder={doc.defaultSep}
                                onChange={(e) => updateDocNumberingField(doc.key, 'separator', e.target.value)}
                                style={{
                                  width: '45px',
                                  padding: '5px 4px',
                                  fontSize: '12px',
                                  textAlign: 'center',
                                  fontWeight: 600,
                                }}
                              />
                            </td>

                            {/* Next Number */}
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <input
                                className="bp-input"
                                disabled={!isEditing}
                                value={cfg.next_number ?? ''}
                                placeholder={doc.defaultNext}
                                onChange={(e) => updateDocNumberingField(doc.key, 'next_number', e.target.value)}
                                style={{
                                  width: '55px',
                                  padding: '5px 6px',
                                  fontSize: '12px',
                                  textAlign: 'center',
                                  fontWeight: 600,
                                }}
                              />
                            </td>

                            {/* Prefix Position */}
                            <td style={{ padding: '10px 10px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                                <label
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    cursor: isEditing ? 'pointer' : 'default',
                                    margin: 0,
                                    fontWeight: cfg.prefix_position === 'first' ? 600 : 400,
                                    color: cfg.prefix_position === 'first' ? '#1e293b' : '#64748b',
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name={`prefix_pos_${doc.key}`}
                                    checked={cfg.prefix_position === 'first'}
                                    disabled={!isEditing}
                                    onChange={() => updateDocNumberingField(doc.key, 'prefix_position', 'first')}
                                    style={{ margin: 0, accentColor: '#2563eb' }}
                                  />
                                  Prefix First
                                </label>
                                <label
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    cursor: isEditing ? 'pointer' : 'default',
                                    margin: 0,
                                    fontWeight: cfg.prefix_position === 'last' ? 600 : 400,
                                    color: cfg.prefix_position === 'last' ? '#1e293b' : '#64748b',
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name={`prefix_pos_${doc.key}`}
                                    checked={cfg.prefix_position === 'last'}
                                    disabled={!isEditing}
                                    onChange={() => updateDocNumberingField(doc.key, 'prefix_position', 'last')}
                                    style={{ margin: 0, accentColor: '#2563eb' }}
                                  />
                                  Prefix Last
                                </label>
                              </div>
                            </td>

                            {/* Numbering Type */}
                            <td style={{ padding: '10px 10px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                                <label
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    cursor: isEditing ? 'pointer' : 'default',
                                    margin: 0,
                                    fontWeight: cfg.numbering_type === 'auto' ? 600 : 400,
                                    color: cfg.numbering_type === 'auto' ? '#1e293b' : '#64748b',
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name={`num_type_${doc.key}`}
                                    checked={cfg.numbering_type === 'auto'}
                                    disabled={!isEditing}
                                    onChange={() => updateDocNumberingField(doc.key, 'numbering_type', 'auto')}
                                    style={{ margin: 0, accentColor: '#2563eb' }}
                                  />
                                  Auto
                                </label>
                                <label
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    cursor: isEditing ? 'pointer' : 'default',
                                    margin: 0,
                                    fontWeight: cfg.numbering_type === 'manual' ? 600 : 400,
                                    color: cfg.numbering_type === 'manual' ? '#1e293b' : '#64748b',
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name={`num_type_${doc.key}`}
                                    checked={cfg.numbering_type === 'manual'}
                                    disabled={!isEditing}
                                    onChange={() => updateDocNumberingField(doc.key, 'numbering_type', 'manual')}
                                    style={{ margin: 0, accentColor: '#2563eb' }}
                                  />
                                  Manual
                                </label>
                              </div>
                            </td>

                            {/* Number Format (Preview) */}
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontWeight: 700,
                                  color: '#1e293b',
                                  background: '#f1f5f9',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                {previewVal || '—'}
                              </span>
                            </td>

                            {/* Status */}
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={Boolean(cfg.status)}
                                disabled={!isEditing}
                                onClick={() => updateDocNumberingField(doc.key, 'status', !cfg.status)}
                                title={cfg.status ? 'Active' : 'Inactive'}
                                style={{
                                  position: 'relative',
                                  display: 'inline-flex',
                                  width: 36,
                                  height: 20,
                                  borderRadius: 9999,
                                  backgroundColor: cfg.status ? '#2563eb' : '#cbd5e1',
                                  border: 'none',
                                  cursor: isEditing ? 'pointer' : 'default',
                                  padding: 2,
                                  transition: 'background-color 0.2s',
                                  verticalAlign: 'middle',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    backgroundColor: '#ffffff',
                                    transform: cfg.status ? 'translateX(16px)' : 'translateX(0)',
                                    transition: 'transform 0.2s',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                  }}
                                />
                              </button>
                            </td>

                            {/* Actions */}
                            <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPreviewDoc(doc.key);
                                  showToast(`Format preview set to ${doc.label}`, 'info');
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: isSelected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                  background: isSelected ? '#eff6ff' : '#ffffff',
                                  color: isSelected ? '#2563eb' : '#475569',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                                View Sample
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Format Preview Card */}
              <div
                style={{
                  width: '280px',
                  flexShrink: 0,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {/* Card Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>
                    Format Preview
                  </span>
                </div>

                {/* Document Type Dropdown */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '5px' }}>
                    Document Type
                  </label>
                  <select
                    className="bp-input"
                    value={selectedPreviewDoc}
                    onChange={(e) => setSelectedPreviewDoc(e.target.value)}
                    style={{ width: '100%', fontSize: '12px', padding: '6px 10px', fontWeight: 500 }}
                  >
                    {DOCUMENT_NUMBERING_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Dashed Sample Box */}
                {(() => {
                  const activeDocCfg = form.document_numbering_settings?.[selectedPreviewDoc] || {
                    prefix: 'INV',
                    separator: '-',
                    next_number: '01',
                    prefix_position: 'first',
                    numbering_type: 'auto',
                    status: true,
                  };
                  const currentSample = formatDocNumber(activeDocCfg);
                  const nextSample = formatNextDocNumber(activeDocCfg);
                  const selectedDocObj = DOCUMENT_NUMBERING_TYPES.find((d) => d.key === selectedPreviewDoc);

                  return (
                    <div
                      style={{
                        border: '1.5px dashed #cbd5e1',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        padding: '24px 14px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                        {selectedDocObj?.label || 'Tax Invoice'}
                      </div>
                      <div
                        style={{
                          fontSize: '24px',
                          fontWeight: 800,
                          color: '#1e293b',
                          letterSpacing: '0.02em',
                          lineHeight: 1.2,
                        }}
                      >
                        {currentSample || '—'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '12px', marginBottom: '6px' }}>
                        Next number will be
                      </div>
                      <div
                        style={{
                          display: 'inline-block',
                          background: '#e2e8f0',
                          color: '#334155',
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '3px 12px',
                          borderRadius: '9999px',
                        }}
                      >
                        {nextSample || '—'}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Bottom Info / Notice Callout Box */}
            <div
              style={{
                marginTop: '20px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: '#2563eb',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                i
              </div>
              <div style={{ fontSize: '12px', color: '#1e3a8a', lineHeight: 1.6 }}>
                <div>• If you select &apos;Auto&apos;, the next number will be automatically incremented after each document is generated.</div>
                <div>• If you select &apos;Manual&apos;, you can enter the document number at the time of creating the document.</div>
                <div>• You can edit the prefix, separator, next number or prefix position at any time.</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Client Login Credentials */}
        {tab === 'credentials' && (
          <div>
            {/* Header Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                marginBottom: 20,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1d4ed8' }}>
                    Client Login Credentials
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
                    Manage client portal access and account settings.
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 6,
                  padding: '8px 12px',
                  maxWidth: 480,
                  fontSize: 11.5,
                  color: '#1e40af',
                  lineHeight: 1.45,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  The password shown here will always reflect the latest password set by the client. If the client resets or updates the password from the portal, it will be updated here automatically.
                </span>
              </div>
            </div>

            {/* Main 2-Column Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 20 }}>
              {/* Left Column: Login Details & Additional Settings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Card 1: Login Details */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '20px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 700, color: '#1e293b' }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Login Details
                    </div>

                    {/* Account Status Switch */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Account Status</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.is_active}
                        disabled={!isEditing}
                        onClick={() => set('is_active', !form.is_active)}
                        style={{
                          position: 'relative',
                          width: 38,
                          height: 20,
                          borderRadius: 10,
                          background: form.is_active ? '#10b981' : '#cbd5e1',
                          border: 'none',
                          cursor: isEditing ? 'pointer' : 'default',
                          padding: 0,
                          transition: 'background 0.2s ease',
                          outline: 'none',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: form.is_active ? 20 : 2,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            transition: 'left 0.2s ease',
                          }}
                        />
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 600, color: form.is_active ? '#15803d' : '#dc2626' }}>
                        {form.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Field 1: User ID (Default) */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#475569', marginBottom: 5 }}>
                      User ID (Default)
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className="bp-input"
                        disabled={!editingUserId && !isEditing}
                        value={form.login_prefix || (form.client_name || form.business_name || '').toLowerCase().replace(/[^a-z0-9]/g, '')}
                        onChange={(e) => set('login_prefix', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                        placeholder="abcprivatelimited"
                        style={{
                          flex: '1 1 auto',
                          background: editingUserId || isEditing ? '#ffffff' : '#f8fafc',
                          fontWeight: 500,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setEditingUserId(!editingUserId)}
                        style={{
                          padding: '7px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#2563eb',
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        {editingUserId ? 'Done' : 'Edit'}
                      </button>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                      User ID is based on the business name. Spaces are removed automatically.
                    </div>
                  </div>

                  {/* Field 2: Password * */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#475569', marginBottom: 5 }}>
                      Password <span style={{ color: '#ef4444' }}>*</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div
                        style={{
                          flex: '1 1 auto',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          fontSize: 14,
                          letterSpacing: 3,
                          color: '#0f172a',
                          fontFamily: 'monospace',
                        }}
                      >
                        <span>••••••••••••</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPasswordModal(true)}
                        style={{
                          padding: '8px 16px',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#ffffff',
                          background: '#2563eb',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
                        }}
                      >
                        Update Password
                      </button>
                    </div>
                  </div>

                  {/* Field 3: Last Login */}
                  <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span style={{ fontSize: 12.5, color: '#475569' }}>
                      Last Login: <strong style={{ color: '#0f172a' }}>{formatDateTime(form.last_login_at || form.user?.last_login_at) || '08 Sep 2026, 02:15 PM'}</strong>
                    </span>
                  </div>

                  {/* Field 4: Two-Factor Authentication (Optional) */}
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
                      Two-Factor Authentication (Optional)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.two_factor_enabled}
                        disabled={!isEditing}
                        onClick={() => set('two_factor_enabled', !form.two_factor_enabled)}
                        style={{
                          position: 'relative',
                          width: 38,
                          height: 20,
                          borderRadius: 10,
                          background: form.two_factor_enabled ? '#2563eb' : '#cbd5e1',
                          border: 'none',
                          cursor: isEditing ? 'pointer' : 'default',
                          padding: 0,
                          transition: 'background 0.2s ease',
                          outline: 'none',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: form.two_factor_enabled ? 20 : 2,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            transition: 'left 0.2s ease',
                          }}
                        />
                      </button>
                      <span style={{ fontSize: 12.5, color: '#334155' }}>
                        Enable 2FA (OTP on Email)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Additional Settings */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '20px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 700, color: '#1e293b', marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    Additional Settings
                  </div>

                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#475569', marginBottom: 5 }}>
                      Session Timeout (Minutes)
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      className="bp-input"
                      disabled={!isEditing}
                      value={form.session_timeout_minutes || 30}
                      onChange={(e) => set('session_timeout_minutes', parseInt(e.target.value, 10) || 30)}
                      style={{ maxWidth: 200 }}
                    />
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                      Client will be logged out automatically after the specified time.
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Card 3 (Login Activity) */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '20px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 700, color: '#1e293b', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Login Activity
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                          <th style={{ padding: '9px 12px', width: 40, fontWeight: 600, textAlign: 'center' }}>#</th>
                          <th style={{ padding: '9px 12px', fontWeight: 600 }}>Login Date & Time</th>
                          <th style={{ padding: '9px 12px', fontWeight: 600 }}>IP Address</th>
                          <th style={{ padding: '9px 12px', width: 90, fontWeight: 600, textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(loginActivity.length > 0 ? loginActivity : DEFAULT_ACTIVITY_LOGS).map((log, idx) => (
                          <tr key={log.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '9px 12px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '9px 12px', color: '#334155' }}>{log.date_time || formatDateTime(log.created_at)}</td>
                            <td style={{ padding: '9px 12px', color: '#475569', fontFamily: 'monospace' }}>{log.ip_address || log.ip}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                              <span
                                style={{
                                  background: (log.status || 'Success').toLowerCase() === 'success' ? '#dcfce7' : '#fee2e2',
                                  color: (log.status || 'Success').toLowerCase() === 'success' ? '#15803d' : '#dc2626',
                                  padding: '2px 9px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  display: 'inline-block',
                                }}
                              >
                                {log.status || 'Success'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ textAlign: 'right', marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (id) {
                        api(`/admin/clients/${id}/login-history?all=1`)
                          .then((res) => {
                            if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
                              setLoginActivity(res.data);
                            } else {
                              alert('All recent logs are currently shown.');
                            }
                          })
                          .catch(() => alert('All recent logs are currently shown.'));
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    View All Logs &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Full-Width Section: Card 4 (Notes) */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '20px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 700, color: '#1e293b' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Notes
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNote(null);
                    setNoteText('');
                    setShowNoteModal(true);
                  }}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '9px 12px', width: 60, fontWeight: 600, textAlign: 'center' }}>S. No.</th>
                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Note</th>
                      <th style={{ padding: '9px 12px', width: 140, fontWeight: 600 }}>Updated On</th>
                      <th style={{ padding: '9px 12px', width: 90, fontWeight: 600, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientNotes.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                          No notes added yet. Click &ldquo;+ Add&rdquo; above to record a note for this client.
                        </td>
                      </tr>
                    ) : (
                      clientNotes.map((item, idx) => (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '9px 12px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '9px 12px', color: '#334155' }}>{item.note}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 11.5 }}>
                            {formatLastUpdated(item.updated_at || item.created_at)}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                              <button
                                type="button"
                                title="Edit Note"
                                onClick={() => {
                                  setEditingNote(item);
                                  setNoteText(item.note);
                                  setShowNoteModal(true);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#2563eb',
                                  padding: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Delete Note"
                                onClick={() => handleDeleteNote(item.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#ef4444',
                                  padding: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Layout (Module 2B - Section B) */}
        {tab === 'layout' && (
          <ClientLayoutTab
            clientId={id}
            isNewClient={!isEdit}
            onDirtyChange={setLayoutIsDirty}
            discardRef={layoutDiscardRef}
          />
        )}

        {/* Tab 8: Configuration (Module 2B - Section C) */}
        {tab === 'configuration' && (
          <ClientConfigurationTab
            clientId={id}
            isNewClient={!isEdit}
            onDirtyChange={setConfigIsDirty}
            discardRef={configDiscardRef}
          />
        )}

        {/* Tab 9: GST Filing Frequency (Module 2A - Section E, PDF Page 19) */}
        {tab === 'gst-frequency' && (
          <div>
            {/* Header Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                    GST Filing Frequency
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
                    Set and manage GST return filing frequency for this client.
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 6,
                  padding: '8px 12px',
                  maxWidth: 480,
                  fontSize: 11.5,
                  color: '#1e40af',
                  lineHeight: 1.45,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#2563eb',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  i
                </div>
                <span>
                  Filing frequency will be applicable from the selected date. Returns for periods before this date will be marked as Non-Applicable.
                </span>
              </div>
            </div>

            {!form.gst_enabled ? (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '48px 24px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    margin: '0 auto 14px',
                    borderRadius: 10,
                    background: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
                  GST not enabled
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0, maxWidth: 460, marginInline: 'auto' }}>
                  GST registration is not enabled for this client. Enable GST under Tab 3 (Registration &amp; Compliance) to view and configure filing frequency.
                </p>
              </div>
            ) : (
              <>
                {/* Top Configuration Bar: 3 Fields in a row */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '16px 20px',
                    marginBottom: 20,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 24,
                    alignItems: 'flex-end',
                  }}
                >
                  {/* Field 1: Dealer Type */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                      Dealer Type
                    </label>
                    <input
                      type="text"
                      className="bp-input"
                      disabled
                      readOnly
                      value={form.registration_type === 'Composition' ? 'Composition Dealer' : 'Regular Dealer'}
                      style={{
                        width: '100%',
                        background: '#f8fafc',
                        color: '#475569',
                        cursor: 'not-allowed',
                      }}
                    />
                  </div>

              {/* Field 2: Opt-Out */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Opt-Out <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="bp-select"
                  disabled={!isEditing || form.registration_type === 'Composition'}
                  value={form.registration_type === 'Composition' ? 'Quarterly' : (form.opt_out || 'Monthly')}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    if (nextVal === 'Select') {
                      set('opt_out', 'Select');
                      return;
                    }
                    set('opt_out', nextVal);
                    if (nextVal === 'Quarterly') {
                      setForm((f) => ({
                        ...f,
                        opt_out: 'Quarterly',
                        gst_filing_frequency: 'quarterly',
                        gstr1_filing_frequency: 'monthly',
                        gstr2b_filing_frequency: 'quarterly',
                      }));
                    } else if (nextVal === 'Monthly') {
                      setForm((f) => ({
                        ...f,
                        opt_out: 'Monthly',
                        gst_filing_frequency: 'monthly',
                        gstr1_filing_frequency: 'monthly',
                        gstr2b_filing_frequency: 'monthly',
                      }));
                    }
                  }}
                  style={{ width: '100%' }}
                >
                  <option value="Select">Select</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                </select>
              </div>

              {/* Field 3: Applicable From */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Applicable From <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="bp-input"
                  disabled={!isEditing}
                  value={form.applicable_from || ''}
                  onChange={(e) => set('applicable_from', e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Dynamic Returns Table (4 Columns matching PDF Page 19) */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', width: 220, fontWeight: 600, color: '#475569', fontSize: 12.5 }}>GST Return</th>
                    <th style={{ padding: '12px 16px', width: 180, fontWeight: 600, color: '#475569', fontSize: 12.5 }}>Filing Frequency</th>
                    <th style={{ padding: '12px 16px', width: 260, fontWeight: 600, color: '#475569', fontSize: 12.5 }}>Due Date (As per Govt. Rules)</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: 12.5 }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingFilingRules ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
                        Loading filing frequency rules…
                      </td>
                    </tr>
                  ) : filingRulesErr || !filingRules?.returns?.length ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '32px 16px', textAlign: 'center', color: '#ef4444', fontWeight: 500 }}>
                        Filing rules could not be loaded
                      </td>
                    </tr>
                  ) : (
                    filingRules.returns.map((ret, idx) => {
                      const isRowEnabled = ret.enabled;
                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isRowEnabled ? '#ffffff' : '#fafafa',
                            color: isRowEnabled ? '#1e293b' : '#94a3b8',
                            opacity: isRowEnabled ? 1 : 0.55,
                          }}
                        >
                          {/* Column 1: GST Return */}
                          <td style={{ padding: '12px 16px', fontWeight: isRowEnabled ? 600 : 500, color: isRowEnabled ? '#1e293b' : '#94a3b8' }}>
                            {ret.return_type}
                          </td>

                          {/* Column 2: Filing Frequency */}
                          <td style={{ padding: '12px 16px' }}>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: 105,
                                padding: '5px 10px',
                                background: isRowEnabled ? '#ffffff' : '#f8fafc',
                                border: `1px solid ${isRowEnabled ? '#cbd5e1' : '#e2e8f0'}`,
                                borderRadius: 6,
                                fontSize: 12.5,
                                color: isRowEnabled ? '#1e293b' : '#94a3b8',
                                fontWeight: 500,
                              }}
                            >
                              <span>{ret.frequency}</span>
                              <span style={{ fontSize: 9, color: isRowEnabled ? '#64748b' : '#cbd5e1' }}>▼</span>
                            </div>
                          </td>

                          {/* Column 3: Due Date */}
                          <td style={{ padding: '12px 16px', color: isRowEnabled ? '#334155' : '#94a3b8', fontSize: 12.5 }}>
                            {ret.due_date}
                          </td>

                          {/* Column 4: Remarks */}
                          <td style={{ padding: '12px 16px', color: isRowEnabled ? '#475569' : '#94a3b8', fontSize: 12.5 }}>
                            {ret.remark}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Note Callout Box matching PDF Page 19 */}
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                padding: '14px 18px',
                marginTop: 18,
                marginBottom: 24,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#2563eb',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                i
              </div>
              <div style={{ fontSize: 12.5, color: '#1e40af', lineHeight: 1.65 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Note:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>
                    • Returns for periods before{' '}
                    <strong>
                      {(() => {
                        const d = form.applicable_from;
                        if (!d) return 'the applicable date';
                        const parts = d.split('-');
                        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
                      })()}
                    </strong>{' '}
                    will be marked as Non-Applicable.
                  </div>
                  <div>• Due dates are as per current Government rules and may be subject to change.</div>
                  <div>• If you change the client type or applicable date, the return frequency and due dates will be updated accordingly.</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )}

        {/* Tab 10: Subscription (Placeholder for Module 2B) */}
        {tab === 'subscription' && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, margin: '0 auto 14px', borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <TabIcon name="subscription" active={false} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1d4ed8', margin: '0 0 6px' }}>
              Client Subscription
            </h3>
            <p style={{ fontSize: 13, color: 'var(--bp-muted, #64748b)', margin: 0 }}>
              Subscription plans and service access controls will be available in Module 2B.
            </p>
          </div>
        )}

        {/* Persistent Bottom Action Bar (Edit / Save Changes / Cancel) - Hidden on Layout and Configuration tabs which have their own action bars */}
        {!['layout', 'configuration'].includes(tab) && (
          <div
            className="cp-actions-bar"
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--bp-border, #e2e8f0)',
            }}
          >
            {isEdit ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCancel}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    padding: '7px 20px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setIsEditing(true);
                    showToast('Edit mode enabled. You can now modify client details.', 'info');
                  }}
                  style={{
                    background: '#2563eb',
                    border: '1px solid #2563eb',
                    color: '#ffffff',
                    padding: '7px 20px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={save}
                  style={{
                    background: '#2563eb',
                    border: '1px solid #2563eb',
                    color: '#ffffff',
                    padding: '7px 20px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.7 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {busy ? 'Saving Changes…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="bp-btn bp-btn-outline"
                  disabled={busy}
                  onClick={() => navigate('/admin/clients')}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="bp-btn bp-btn-primary"
                  disabled={busy}
                  onClick={save}
                >
                  {busy ? 'Adding Client…' : 'Save Profile'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Discard Changes Modal Guard */}
      {showDiscardModal && (
        <DiscardChangesModal
          onContinueEditing={() => setShowDiscardModal(false)}
          onConfirmCancel={() => {
            setForm({ ...originalForm });
            setIsEditing(false);
            setShowDiscardModal(false);
            showToast('Changes discarded. Exited edit mode.', 'warning');
          }}
        />
      )}

      {/* Layout Tab Discard Changes Guard */}
      {showLayoutDiscardModal && (
        <DiscardChangesModal
          onContinueEditing={() => {
            setShowLayoutDiscardModal(false);
            setPendingTabChange(null);
          }}
          onConfirmCancel={() => {
            layoutDiscardRef.current?.();
            setLayoutIsDirty(false);
            setShowLayoutDiscardModal(false);
            if (pendingTabChange) {
              setTab(pendingTabChange);
              setPendingTabChange(null);
            }
          }}
        />
      )}

      {/* Configuration Tab Discard Changes Guard */}
      {showConfigDiscardModal && (
        <DiscardChangesModal
          onContinueEditing={() => {
            setShowConfigDiscardModal(false);
            setPendingTabChange(null);
          }}
          onConfirmCancel={() => {
            configDiscardRef.current?.();
            setConfigIsDirty(false);
            setShowConfigDiscardModal(false);
            if (pendingTabChange) {
              setTab(pendingTabChange);
              setPendingTabChange(null);
            }
          }}
        />
      )}

      {/* Edit Success Modal */}
      {showSaveSuccess && (
        <ClientSaveSuccessModal
          isOpen={showSaveSuccess}
          onClose={() => setShowSaveSuccess(false)}
        />
      )}

      {/* Create Success Modal */}
      {showCreateSuccess && (
        <ClientCreateSuccessModal
          isOpen={showCreateSuccess}
          clientId={createdInfo.clientId}
          clientName={createdInfo.clientName}
          onClose={() => navigate('/admin/clients')}
          onGoToDetails={() => {
            setShowCreateSuccess(false);
            navigate(`/admin/clients/${createdInfo.id}/edit`);
          }}
        />
      )}

      {/* Add / Edit Information Modal (Tab 1) */}
      {showAddInfoModal && (
        <AddInformationModal
          isOpen={showAddInfoModal}
          onClose={() => {
            setShowAddInfoModal(false);
            setSelectedEditInfo(null);
          }}
          onSaved={() => {
            loadAdditionalInfos();
            const nowIso = new Date().toISOString();
            setForm((f) => ({ ...f, updated_at: nowIso }));
            setOriginalForm((f) => ({ ...f, updated_at: nowIso }));
          }}
          clientId={id}
          editItem={selectedEditInfo}
        />
      )}

      {/* Set / Reset Client Password Modal (Tab 6) */}
      {showPasswordModal && (
        <SetPasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={handlePasswordSuccess}
          clientId={id}
          clientName={form.client_name || form.business_name}
        />
      )}

      {/* Add / Edit Note Modal (Tab 6) */}
      {showNoteModal && (
        <AddClientNoteModal
          isOpen={showNoteModal}
          onClose={() => {
            setShowNoteModal(false);
            setEditingNote(null);
          }}
          onSave={handleSaveNote}
          editNote={editingNote}
          loading={savingNote}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <>
          <style>{`
            @keyframes toastSlideIn {
              from {
                opacity: 0;
                transform: translateY(-16px) scale(0.96);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'fixed',
              top: 24,
              right: 24,
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderLeft: `4px solid ${
                toast.type === 'success'
                  ? '#16a34a'
                  : toast.type === 'warning'
                  ? '#f59e0b'
                  : toast.type === 'error'
                  ? '#dc2626'
                  : '#2563eb'
              }`,
              borderRadius: 8,
              padding: '12px 18px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
              minWidth: 280,
              maxWidth: 420,
              animation: 'toastSlideIn 0.22s ease-out',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background:
                  toast.type === 'success'
                    ? '#dcfce7'
                    : toast.type === 'warning'
                    ? '#fef3c7'
                    : toast.type === 'error'
                    ? '#fee2e2'
                    : '#eff6ff',
                color:
                  toast.type === 'success'
                    ? '#16a34a'
                    : toast.type === 'warning'
                    ? '#d97706'
                    : toast.type === 'error'
                    ? '#dc2626'
                    : '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {toast.type === 'success' ? '✓' : toast.type === 'warning' ? '↩' : toast.type === 'error' ? '✕' : 'ℹ'}
            </div>
            <div style={{ flex: '1 1 auto', fontSize: 13, color: '#1e293b', fontWeight: 500, lineHeight: 1.4 }}>
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 15,
                padding: '0 0 0 8px',
                lineHeight: 1,
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}
