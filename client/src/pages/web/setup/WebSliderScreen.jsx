import { useEffect, useState } from 'react';

export default function WebSliderScreen({ data, busy, onLoad, onSave }) {
  const [slides, setSlides] = useState([]);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.slides) setSlides(data.slides);
  }, [data]);

  const updateSlide = (index, patch) => {
    setSlides((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <form
      className="cis-setup-form"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({ slides });
      }}
    >
      {slides.map((slide, index) => (
        <div key={slide.id || index} className="border rounded p-3 mb-3">
          <h6 className="mb-3">Slide {index + 1}</h6>
          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label">Type</label>
              <select className="form-select" value={slide.objectType} onChange={(e) => updateSlide(index, { objectType: e.target.value })}>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Order</label>
              <input type="number" className="form-control" value={slide.orderNo} onChange={(e) => updateSlide(index, { orderNo: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Image filename</label>
              <input className="form-control" value={slide.imageName} onChange={(e) => updateSlide(index, { imageName: e.target.value })} />
            </div>
            <div className="col-md-3">
              <label className="form-label">BG color</label>
              <input className="form-control" value={slide.bgColor} onChange={(e) => updateSlide(index, { bgColor: e.target.value })} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Text color</label>
              <input className="form-control" value={slide.foreColor} onChange={(e) => updateSlide(index, { foreColor: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Content link</label>
              <input className="form-control" value={slide.contentLink} onChange={(e) => updateSlide(index, { contentLink: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Title</label>
              <input className="form-control" value={slide.contentTitle} onChange={(e) => updateSlide(index, { contentTitle: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="form-label">Message</label>
              <textarea className="form-control" rows={2} value={slide.contentMessage} onChange={(e) => updateSlide(index, { contentMessage: e.target.value })} />
            </div>
            <div className="col-12 d-flex flex-wrap gap-3">
              <label><input type="checkbox" checked={slide.widgetEnable} onChange={(e) => updateSlide(index, { widgetEnable: e.target.checked })} /> Widget</label>
              <label><input type="checkbox" checked={slide.imageEnable} onChange={(e) => updateSlide(index, { imageEnable: e.target.checked })} /> Image</label>
              <label><input type="checkbox" checked={slide.contentEnable} onChange={(e) => updateSlide(index, { contentEnable: e.target.checked })} /> Content</label>
            </div>
          </div>
        </div>
      ))}
      <button type="submit" className="btn btn-danger" disabled={busy || !slides.length}>Save slider</button>
    </form>
  );
}
