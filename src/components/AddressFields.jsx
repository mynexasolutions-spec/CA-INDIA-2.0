import { useState } from 'react';
import { api } from '../api/client';
import { COUNTRIES } from '../data/countries';
import { INDIAN_STATES } from '../data/indianStates';
import StateSelect from './StateSelect';

/**
 * Shared Address Component (Module 2A - Section C)
 * Reusable across Personal Information, Communication Address, Business Address, etc.
 *
 * Fields:
 * - Address Line 1 *
 * - Address Line 2
 * - Country * (dropdown with COUNTRIES, default 'India')
 * - State * (dropdown via StateSelect when India, text input when non-India)
 * - PIN Code * (6-digit numeric lookup for India auto-populating City and State)
 * - City * (auto-fetched on PIN lookup for India; manual entry if lookup fails or non-India)
 *
 * Props:
 * - values: object containing address fields (e.g. form state)
 * - onChange(key, value): field update handler
 * - onBatchChange(updates): optional batch update handler { key1: val1, key2: val2 }
 * - prefix: string prefix for keys (e.g. '' for personal, 'comm_' for communication)
 * - disabled / readOnly: boolean
 * - errors: object with field error messages
 * - className: optional CSS class for container
 */
export default function AddressFields({
  values = {},
  onChange,
  onBatchChange,
  prefix = '',
  disabled = false,
  readOnly = false,
  errors = {},
  className = '',
}) {
  const isLocked = disabled || readOnly;

  const [loadingPin, setLoadingPin] = useState(false);
  const [pinError, setPinError] = useState('');

  const getVal = (field) => values[`${prefix}${field}`] ?? '';
  const currentCountry = getVal('country') || 'India';

  const updateField = (field, val) => {
    const key = `${prefix}${field}`;
    if (onBatchChange) {
      onBatchChange({ [key]: val });
    } else if (onChange) {
      onChange(key, val);
    }
  };

  const updateMultiple = (updates) => {
    const prefixedUpdates = {};
    for (const [k, v] of Object.entries(updates)) {
      prefixedUpdates[`${prefix}${k}`] = v;
    }
    if (onBatchChange) {
      onBatchChange(prefixedUpdates);
    } else if (onChange) {
      for (const [k, v] of Object.entries(prefixedUpdates)) {
        onChange(k, v);
      }
    }
  };

  const fieldError = (f) => errors?.[`${prefix}${f}`] || errors?.[f];

  const handlePincodeChange = async (e) => {
    const raw = e.target.value;

    if (currentCountry === 'India') {
      const cleaned = raw.replace(/\D/g, '').slice(0, 6);
      updateField('pincode', cleaned);

      if (cleaned.length < 6) {
        setPinError('');
        return;
      }

      if (cleaned.length === 6) {
        setLoadingPin(true);
        setPinError('');
        try {
          const res = await api(`/admin/lookup/pin/${cleaned}`);
          if (res && res.success) {
            const updates = { city: res.city || '' };
            if (res.state) {
              updates.state = res.state;
              const matchedState = INDIAN_STATES.find(
                (s) => s.name.toLowerCase() === res.state.toLowerCase()
              );
              if (matchedState) {
                updates.state_code = matchedState.code;
              }
            }
            updateMultiple(updates);
          } else {
            setPinError(res?.message || 'Invalid or unknown PIN code. City must be entered manually.');
            updateField('city', '');
          }
        } catch (err) {
          setPinError(err.message || 'Invalid or unknown PIN code. City must be entered manually.');
          updateField('city', '');
        } finally {
          setLoadingPin(false);
        }
      }
    } else {
      updateField('pincode', raw);
      setPinError('');
    }
  };

  const errorStyle = {
    color: 'var(--bp-red, #dc2626)',
    fontSize: '11.5px',
    marginTop: '4px',
    fontWeight: '500',
  };

  return (
    <div
      className={`address-fields-grid ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '14px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: 'var(--bp-text, #0f172a)' }}>
          Address Line 1 <span style={{ color: 'var(--bp-red, #dc2626)' }}>*</span>
        </label>
        <input
          type="text"
          className="bp-input"
          disabled={isLocked}
          value={getVal('address_line_1')}
          onChange={(e) => updateField('address_line_1', e.target.value)}
          placeholder="Flat, House no., Building, Company, Apartment"
        />
        {fieldError('address_line_1') && <div style={errorStyle}>{fieldError('address_line_1')}</div>}
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: 'var(--bp-text, #0f172a)' }}>
          Address Line 2
        </label>
        <input
          type="text"
          className="bp-input"
          disabled={isLocked}
          value={getVal('address_line_2')}
          onChange={(e) => updateField('address_line_2', e.target.value)}
          placeholder="Area, Street, Sector, Village"
        />
        {fieldError('address_line_2') && <div style={errorStyle}>{fieldError('address_line_2')}</div>}
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: 'var(--bp-text, #0f172a)' }}>
          Country <span style={{ color: 'var(--bp-red, #dc2626)' }}>*</span>
        </label>
        <select
          className="bp-select"
          disabled={isLocked}
          value={currentCountry}
          onChange={(e) => {
            const nextCountry = e.target.value;
            updateField('country', nextCountry);
            if (nextCountry !== 'India') {
              setPinError('');
            }
          }}
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {fieldError('country') && <div style={errorStyle}>{fieldError('country')}</div>}
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: 'var(--bp-text, #0f172a)' }}>
          State <span style={{ color: 'var(--bp-red, #dc2626)' }}>*</span>
        </label>
        {currentCountry === 'India' ? (
          <StateSelect
            value={getVal('state_code') || getVal('state')}
            valueMode={getVal('state_code') ? 'code' : 'name'}
            disabled={isLocked}
            onChange={(code, name) => {
              updateMultiple({ state_code: code, state: name });
            }}
          />
        ) : (
          <input
            type="text"
            className="bp-input"
            disabled={isLocked}
            value={getVal('state')}
            onChange={(e) => updateField('state', e.target.value)}
            placeholder="State / Province / Region"
          />
        )}
        {fieldError('state') && <div style={errorStyle}>{fieldError('state')}</div>}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--bp-text, #0f172a)' }}>
            {currentCountry === 'India' ? 'PIN Code' : 'Postal Code'} <span style={{ color: 'var(--bp-red, #dc2626)' }}>*</span>
          </label>
          {loadingPin && (
            <span style={{ fontSize: 11.5, color: 'var(--bp-blue, #2563eb)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  border: '2px solid #2563eb',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              Looking up…
            </span>
          )}
        </div>
        <input
          type="text"
          className="bp-input"
          disabled={isLocked}
          value={getVal('pincode')}
          maxLength={currentCountry === 'India' ? 6 : 12}
          onChange={handlePincodeChange}
          placeholder={currentCountry === 'India' ? '6-digit PIN code (e.g. 400706)' : 'Postal Code'}
        />
        {pinError && <div style={errorStyle}>{pinError}</div>}
        {fieldError('pincode') && !pinError && <div style={errorStyle}>{fieldError('pincode')}</div>}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--bp-text, #0f172a)' }}>
            City <span style={{ color: 'var(--bp-red, #dc2626)' }}>*</span>
          </label>
          {currentCountry === 'India' && (
            <span style={{ fontSize: 11, color: 'var(--bp-muted, #64748b)' }}>(auto-fetched)</span>
          )}
        </div>
        <input
          type="text"
          className="bp-input"
          disabled={isLocked}
          value={getVal('city')}
          onChange={(e) => updateField('city', e.target.value)}
          placeholder="City / Town / District"
        />
        {fieldError('city') && <div style={errorStyle}>{fieldError('city')}</div>}
      </div>
    </div>
  );
}
