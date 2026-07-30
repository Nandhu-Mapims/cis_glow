import { useEffect, useState } from 'react';
import { FormActionBar, FormSection, FormSectionNav, useScrollSpy } from '../../../components/FormShell';

const emptyForm = {
  resourceType: '', accessionNo: '', resourceName: '', resourceSubname: '', convertTitle: '', convertName: '', ebookAttachment: '', referenceCopy: false,
  authorName: '', publisherName: '', supplierCode: '', source: '0', resourceSubject: '', resourceDepartment: '', callNumber: '', copyNo: '1', isbnNo: '', edition: '', revisedEdition: false, year: '', volume: '',
  shelfNo: '', rackNo: '', pageNo: '', numberOfDisks: '', billNo: '', billDate: '', price: '', remarks: '',
};

function TextField({ form, set, name, label, required = false, type = 'text', className = 'col-md-6', placeholder }) {
  return <div className={className}><label className="form-label" htmlFor={name}>{label}{required && <span className="text-danger"> *</span>}</label><input id={name} type={type} className="form-control" placeholder={placeholder} value={form[name] || ''} required={required} onChange={(e) => set(name, e.target.value)} /></div>;
}

function SelectField({ form, set, name, label, options = [], required = false, className = 'col-md-6' }) {
  return <div className={className}><label className="form-label" htmlFor={name}>{label}{required && ' *'}</label><select id={name} className="form-select" value={form[name] || ''} required={required} onChange={(e) => set(name, e.target.value)}><option value="">-- Select --</option>{options.map((option) => <option key={option.id ?? option.value} value={option.id ?? option.value}>{option.name ?? option.label}</option>)}</select></div>;
}

const sections = [
  { id: 'resource-details', title: 'Resource details' },
  { id: 'contributors', title: 'Contributors' },
  { id: 'classification', title: 'Classification' },
  { id: 'inventory', title: 'Inventory & price' },
];

export default function BookAddSetup({ data, busy, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const activeSection = useScrollSpy(sections.map((section) => section.id));
  useEffect(() => { if (data?.book) setForm((previous) => ({ ...previous, ...data.book })); }, [data]);
  const submit = async (event) => { event.preventDefault(); const result = await onSave(form); if (result?.success) setForm(emptyForm); };
  const checkbox = (name, label, className = 'col-md-6') => <div className={`${className} d-flex align-items-end pb-2`}><div className="form-check"><input id={name} className="form-check-input" type="checkbox" checked={Boolean(form[name])} onChange={(e) => set(name, e.target.checked)} /><label className="form-check-label" htmlFor={name}>{label}</label></div></div>;

  return <form onSubmit={submit} className="cis-form-layout">
    <FormSectionNav sections={sections} activeId={activeSection} heading="Resource entry" />
    <div className="cis-form-main">
      <FormSection id="resource-details" title="Resource details" description="Identify the item and its title information.">
        <SelectField form={form} set={set} name="resourceType" label="Resource type" required options={data?.resourceTypes} />
        <TextField form={form} set={set} name="accessionNo" label="Accession No." required placeholder="e.g. LIB-000124" />
        <TextField form={form} set={set} name="resourceName" label="Title" required placeholder="Enter the resource title" />
        <TextField form={form} set={set} name="resourceSubname" label="Sub title" placeholder="Optional subtitle" />
        <TextField form={form} set={set} name="convertTitle" label="Convert title" placeholder="Enter converted title" />
        <TextField form={form} set={set} name="convertName" label="Converted title" placeholder="Enter translated title" />
        <div className="col-md-6"><label className="form-label" htmlFor="ebookAttachment">E-book file</label><input id="ebookAttachment" type="file" className="form-control" onChange={(e) => set('ebookAttachment', e.target.files?.[0]?.name || '')} />{form.ebookAttachment && <div className="form-text"><i className="fa fa-paperclip me-1" aria-hidden="true" />{form.ebookAttachment}</div>}</div>
        {checkbox('referenceCopy', 'Keep as reference copy')}
      </FormSection>

      <FormSection id="contributors" title="Contributors & source" description="Record who created, supplied, or published this resource.">
        <TextField form={form} set={set} name="authorName" label="Author" required placeholder="Author name" />
        <TextField form={form} set={set} name="publisherName" label="Publisher" placeholder="Publisher name" />
        <SelectField form={form} set={set} name="supplierCode" label="Supplier" options={data?.suppliers} />
        <SelectField form={form} set={set} name="source" label="Source" options={[{ value: '0', label: 'Purchase' }, { value: '1', label: 'Donation' }]} />
      </FormSection>

      <FormSection id="classification" title="Classification" description="Add the catalogue and academic classification details.">
        <SelectField form={form} set={set} name="resourceSubject" label="Subject" options={data?.courseTypes} />
        <SelectField form={form} set={set} name="resourceDepartment" label="Branch" options={data?.departments} />
        <TextField form={form} set={set} name="callNumber" label="Call No." placeholder="Catalogue call number" />
        <TextField form={form} set={set} name="copyNo" label="Copy No." />
        <TextField form={form} set={set} name="isbnNo" label="ISBN No." placeholder="ISBN" />
        <TextField form={form} set={set} name="edition" label="Edition" placeholder="e.g. 3rd edition" />
        {checkbox('revisedEdition', 'Revised edition')}
        <TextField form={form} set={set} name="year" label="Published year" type="number" placeholder="YYYY" />
        <TextField form={form} set={set} name="volume" label="Volume" placeholder="Volume number" />
      </FormSection>

      <FormSection id="inventory" title="Inventory & price" description="Set the physical location and purchasing information.">
        <TextField form={form} set={set} name="shelfNo" label="Shelf No." placeholder="Shelf location" />
        <TextField form={form} set={set} name="rackNo" label="Rack No." placeholder="Rack location" />
        <TextField form={form} set={set} name="pageNo" label="Page No." />
        <TextField form={form} set={set} name="numberOfDisks" label="No. of disks" type="number" />
        <TextField form={form} set={set} name="billNo" label="Bill No." placeholder="Invoice number" />
        <TextField form={form} set={set} name="billDate" label="Bill date" type="date" />
        <TextField form={form} set={set} name="price" label="Price" type="number" placeholder="0.00" />
        <TextField form={form} set={set} name="remarks" label="Remarks" placeholder="Optional notes" />
      </FormSection>

      <FormActionBar note="Fields marked with * are required.">
        <button type="submit" className="btn btn-primary px-4" disabled={busy}><i className="fa fa-plus me-2" aria-hidden="true" />{busy ? 'Adding resource…' : 'Add resource'}</button>
      </FormActionBar>
    </div>
  </form>;
}
