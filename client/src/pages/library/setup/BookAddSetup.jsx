import { useEffect, useState } from 'react';
import api from '../../../api/client';
import { FormActionBar, FormSection, FormSectionNav, useScrollSpy } from '../../../components/FormShell';

const emptyForm = {
  resourceType: '', accessionNo: '', resourceName: '', resourceSubname: '', convertTitle: '', convertName: '', ebookFile: null, referenceCopy: false,
  authorName: '', publisherName: '', supplierCode: '', source: '', resourceSubject: '', resourceDepartment: [], callNumber: '', copyNo: '1', isbnNo: '', issnMonth: '', edition: '', revisedEdition: false, year: '', volume: '',
  shelfNo: '', rackNo: '', pageNo: '', numberOfDisks: '', billNo: '', billDate: '', price: '', remarks: '',
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function TextField({ form, set, name, label, required = false, type = 'text', className = 'col-md-6', placeholder }) {
  return <div className={className}><label className="form-label" htmlFor={name}>{label}{required && <span className="text-danger"> *</span>}</label><input id={name} type={type} className="form-control" placeholder={placeholder} value={form[name] || ''} required={required} onChange={(e) => set(name, e.target.value)} /></div>;
}

function SelectField({ form, set, name, label, options = [], required = false, className = 'col-md-6', onChangeExtra }) {
  return <div className={className}><label className="form-label" htmlFor={name}>{label}{required && ' *'}</label><select id={name} className="form-select" value={form[name] || ''} required={required} onChange={(e) => { set(name, e.target.value); onChangeExtra?.(e.target.value); }}><option value="">-- Select --</option>{options.map((option) => <option key={option.id ?? option.value} value={option.id ?? option.value}>{option.name ?? option.label}</option>)}</select></div>;
}

const sections = [
  { id: 'resource-details', title: 'Resource details' },
  { id: 'contributors', title: 'Contributors' },
  { id: 'classification', title: 'Classification' },
  { id: 'inventory', title: 'Inventory & price' },
];

export default function BookAddSetup({ data, busy, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [availability, setAvailability] = useState(null); // null | 'available' | 'unavailable' | 'checking'
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const activeSection = useScrollSpy(sections.map((section) => section.id));
  useEffect(() => { if (data?.book) setForm((previous) => ({ ...previous, ...data.book })); }, [data]);

  const submit = async (event) => {
    event.preventDefault();
    let ebookFile = null;
    if (form.ebookFile instanceof File) {
      ebookFile = { name: form.ebookFile.name, data: await readFileAsDataUrl(form.ebookFile) };
    }
    const result = await onSave({ ...form, ebookFile });
    if (result?.success) { setForm(emptyForm); setAvailability(null); }
  };

  const checkbox = (name, label, className = 'col-md-6') => <div className={`${className} d-flex align-items-end pb-2`}><div className="form-check"><input id={name} className="form-check-input" type="checkbox" checked={Boolean(form[name])} onChange={(e) => set(name, e.target.checked)} /><label className="form-check-label" htmlFor={name}>{label}</label></div></div>;

  const checkAvailability = async () => {
    const accessionNo = String(form.accessionNo || '').trim();
    if (!accessionNo) return;
    setAvailability('checking');
    try {
      const res = await api.post('/api/library/setup/book-add/load', { fields: { action: 'check-availability', accessionNo } });
      setAvailability(res.data?.available ? 'available' : 'unavailable');
    } catch {
      setAvailability(null);
    }
  };

  const isJournal = (data?.resourceTypes || []).find((r) => String(r.id) === String(form.resourceType) && /journal/i.test(r.name || ''));
  const isEbook = data?.ebookCategoryId && String(data.ebookCategoryId) === String(form.resourceType);

  return <form onSubmit={submit} className="cis-form-layout">
    <FormSectionNav sections={sections} activeId={activeSection} heading="Resource entry" />
    <div className="cis-form-main">
      <FormSection id="resource-details" title="Resource details" description="Identify the item and its title information.">
        <SelectField form={form} set={set} name="resourceType" label="Resource" required options={data?.resourceTypes} />
        <div className="col-md-6">
          <label className="form-label" htmlFor="accessionNo">Accession No.<span className="text-danger"> *</span></label>
          <div className="input-group">
            <input id="accessionNo" className="form-control" maxLength={20} required value={form.accessionNo || ''} onChange={(e) => { set('accessionNo', e.target.value); setAvailability(null); }} onBlur={checkAvailability} />
            <button type="button" className="btn btn-outline-secondary" onClick={checkAvailability} title="Check availability"><i className="fa fa-search" aria-hidden="true" /></button>
          </div>
          {availability === 'available' && <div className="form-text text-success">Available</div>}
          {availability === 'unavailable' && <div className="form-text text-danger">Not Available</div>}
        </div>
        <TextField form={form} set={set} name="resourceName" label="Title" required placeholder="Enter the resource title" />
        <TextField form={form} set={set} name="resourceSubname" label="Sub title" placeholder="Optional subtitle" />
        <TextField form={form} set={set} name="convertTitle" label="Convert title" placeholder="Enter converted title" />
        <TextField form={form} set={set} name="convertName" label="Title (converted)" placeholder="Enter translated title" />
        {isEbook && (
          <div className="col-md-6">
            <label className="form-label" htmlFor="ebookFile">E-book upload (.pdf)</label>
            <input id="ebookFile" type="file" accept=".pdf,application/pdf" className="form-control" onChange={(e) => set('ebookFile', e.target.files?.[0] || null)} />
            {form.ebookFile instanceof File && <div className="form-text"><i className="fa fa-paperclip me-1" aria-hidden="true" />{form.ebookFile.name}</div>}
          </div>
        )}
        {checkbox('referenceCopy', 'Keep as reference copy')}
      </FormSection>

      <FormSection id="contributors" title="Contributors & source" description="Record who created, supplied, or published this resource.">
        <TextField form={form} set={set} name="authorName" label="Author" required placeholder="Author name" />
        <TextField form={form} set={set} name="publisherName" label="Publisher" placeholder="Publisher name" />
        <SelectField form={form} set={set} name="supplierCode" label="Supplier" options={data?.suppliers} />
        <SelectField form={form} set={set} name="source" label="Source" options={data?.sources} />
      </FormSection>

      <FormSection id="classification" title="Classification" description="Add the catalogue and academic classification details.">
        <SelectField form={form} set={set} name="resourceSubject" label="Subject" options={data?.subjects} />
        <div className="col-md-6">
          <label className="form-label">Branch</label>
          <select multiple className="form-select" value={(form.resourceDepartment || []).map(String)} onChange={(e) => set('resourceDepartment', Array.from(e.target.selectedOptions).map((o) => o.value))}>
            {(data?.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="form-text">Ctrl/Cmd-click to select multiple branches.</div>
        </div>
        <TextField form={form} set={set} name="callNumber" label="Call No." placeholder="Catalogue call number" />
        <TextField form={form} set={set} name="copyNo" label="Copy No." />
        <TextField form={form} set={set} name="isbnNo" label={isJournal ? 'ISSN No.' : 'ISBN No.'} placeholder={isJournal ? 'ISSN' : 'ISBN'} />
        {isJournal && <TextField form={form} set={set} name="issnMonth" label="Month" placeholder="Issue month" />}
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
