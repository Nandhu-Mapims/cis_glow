import ChipMultiSelect from '../../../components/ChipMultiSelect.jsx';

export default function HoldMonthPicker({
  options = [],
  value = [],
  onChange,
  disabled = false,
}) {
  return (
    <ChipMultiSelect
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      showSearch={options.length > 6}
      searchPlaceholder="Search month..."
      emptySelectionText="No hold months selected"
      emptySearchText="Set deduction from and months first."
      footer={(
        <span className="small text-muted">Select months to skip during the deduction schedule.</span>
      )}
    />
  );
}
