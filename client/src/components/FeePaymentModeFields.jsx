const MODES = ['Bank', 'RTGS/NEFT', 'Cash', 'Cheque', 'D.D'];

export const DEFAULT_FEE_PAYMENT = {
  amountType: 'Bank',
  bankRefNo: '',
  bankDate: '',
  bankAmount: '',
  otherte: '',
  fivete: '',
  onehu: '',
  fivehu: '',
  oneth: '',
  chequeNo: '',
  chequeDate: '',
  chequeBankName: '',
  chequeAmount: '',
};

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div className="col-md-4">
      <label className="form-label small mb-1">{label}</label>
      <input type={type} className="form-control form-control-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function FeePaymentModeFields({ payment, onChange }) {
  const set = (key, value) => onChange({ ...payment, [key]: value });
  const mode = payment.amountType;

  return (
    <div className="border rounded p-3 bg-light">
      <div className="row g-2 align-items-end mb-2">
        <div className="col-md-3">
          <label className="form-label small mb-1">Payment mode</label>
          <select className="form-select form-select-sm" value={mode} onChange={(e) => set('amountType', e.target.value)}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {(mode === 'Bank' || mode === 'RTGS/NEFT') && (
        <div className="row g-2">
          <Field label="Transaction no." value={payment.bankRefNo} onChange={(v) => set('bankRefNo', v)} />
          <Field label="Bank date (dd-mm-yyyy)" value={payment.bankDate} onChange={(v) => set('bankDate', v)} />
          <Field label="Amount" value={payment.bankAmount} onChange={(v) => set('bankAmount', v)} />
        </div>
      )}

      {mode === 'Cash' && (
        <div className="row g-2">
          <Field label="₹2000 x" value={payment.oneth} onChange={(v) => set('oneth', v)} />
          <Field label="₹500 x" value={payment.fivehu} onChange={(v) => set('fivehu', v)} />
          <Field label="₹100 x" value={payment.onehu} onChange={(v) => set('onehu', v)} />
          <Field label="₹50 x" value={payment.fivete} onChange={(v) => set('fivete', v)} />
          <Field label="Other" value={payment.otherte} onChange={(v) => set('otherte', v)} />
        </div>
      )}

      {(mode === 'Cheque' || mode === 'D.D') && (
        <div className="row g-2">
          <Field label={mode === 'D.D' ? 'D.D no.' : 'Cheque no.'} value={payment.chequeNo} onChange={(v) => set('chequeNo', v)} />
          <Field label="Date (dd-mm-yyyy)" value={payment.chequeDate} onChange={(v) => set('chequeDate', v)} />
          <Field label="Bank name" value={payment.chequeBankName} onChange={(v) => set('chequeBankName', v)} />
          <Field label="Amount" value={payment.chequeAmount} onChange={(v) => set('chequeAmount', v)} />
        </div>
      )}
    </div>
  );
}
