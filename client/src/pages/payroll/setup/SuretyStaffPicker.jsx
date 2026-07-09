import ChipMultiSelect from '../../../components/ChipMultiSelect.jsx';

export default function SuretyStaffPicker({
  options = [],
  value = [],
  onChange,
  max = 2,
  disabled = false,
}) {
  return (
    <ChipMultiSelect
      options={options}
      value={value}
      onChange={onChange}
      max={max}
      disabled={disabled}
      searchPlaceholder="Search by name or staff ID..."
      emptySelectionText="No surety staff selected"
      emptySearchText="No staff match your search."
      footer={(
        <span className="small text-muted">
          <span className="text-danger fw-semibold">**</span>
          {' '}
          — staff already acting as surety for two open records
        </span>
      )}
    />
  );
}
