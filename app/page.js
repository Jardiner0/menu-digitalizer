'use client';

import { useState } from 'react';

export default function Home() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [menuData, setMenuData] = useState(null);
  const [error, setError] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (menuData && !confirm('Upload new menu? Current data will be lost.')) {
        e.target.value = '';
        return;
      }
      setImage(file);
      setFileName(file.name);
      setPreview(URL.createObjectURL(file));
      setError(null);
      uploadImage(file);
    }
  };

  const compressImage = (file, maxWidth = 1920, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize if too large
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              resolve(blob);
            },
            file.type,
            quality
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const uploadImage = async (file) => {
    setLoading(true);
    setError(null);
    setMenuData(null);

    try {
      // Compress image first
      const compressedBlob = await compressImage(file);
      
      const reader = new FileReader();
      reader.readAsDataURL(compressedBlob);
      
      reader.onload = async () => {
        try {
          const base64Image = reader.result.split(',')[1];
          const response = await fetch('/api/analyze-menu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image, mediaType: file.type }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Failed to analyze menu');
          setMenuData(data.menu);
          setLoading(false);
        } catch (err) {
          setError(err.message);
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read image');
        setLoading(false);
      };
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // FIX: Add optional chaining and default empty object
  const groupedItems = menuData?.items?.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {}) || {};

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(menuData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${menuData.restaurant_name || 'menu'}_data.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ['Category', 'Item Name', 'Price', 'Description', 'Ingredients', 'Allergens', 'Dietary Tags'];
    const rows = menuData.items.map(item => [
      item.category || '', item.name || '', item.price || '', item.description || '',
      (item.ingredients || []).join('; '), (item.allergens || []).join('; '), (item.dietary || []).join('; ')
    ]);
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${menuData.restaurant_name || 'menu'}_data.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateItemField = (itemIndex, field, value) => {
    setIsSaving(true);
    const newItems = [...menuData.items];
    if (['ingredients', 'allergens', 'dietary'].includes(field)) {
      newItems[itemIndex][field] = value.split(',').map(v => v.trim()).filter(Boolean);
    } else {
      newItems[itemIndex][field] = value;
    }
    setMenuData({ ...menuData, items: newItems });
    setTimeout(() => setIsSaving(false), 800);
  };

  const deleteItem = (itemIndex) => {
    setMenuData({ ...menuData, items: menuData.items.filter((_, i) => i !== itemIndex) });
  };

  const clearMenu = () => {
    if (confirm('Clear menu? Cannot be undone.')) {
      setMenuData(null);
      setImage(null);
      setPreview(null);
      setFileName(null);
      setError(null);
      setEditingField(null);
    }
  };

  const getCategoryIcon = (cat) => {
    const icons = { breakfast: '🌅', lunch: '🍽️', dinner: '🌙', appetizer: '🥗', appetizers: '🥗',
      main: '🍴', mains: '🍴', dessert: '🍰', desserts: '🍰', beverage: '☕', beverages: '☕',
      drinks: '🥤', salad: '🥗', salads: '🥗', sandwich: '🥪', sandwiches: '🥪', pizza: '🍕', pasta: '🍝' };
    return icons[cat.toLowerCase()] || '🍽️';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Menu Digitalizer</h1>
                {menuData?.restaurant_name && <p className="text-xs sm:text-sm text-cyan-400">{menuData.restaurant_name}</p>}
              </div>
            </div>
            {fileName && <p className="text-xs text-slate-400 mt-2 ml-13 truncate max-w-[200px] sm:max-w-none">📄 {fileName}</p>}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            {isSaving && (
              <div className="flex items-center gap-2 bg-emerald-500/20 px-3 sm:px-4 py-2 rounded-xl border border-emerald-400/30 animate-pulse">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs sm:text-sm font-medium text-emerald-400 hidden sm:inline">Saved</span>
              </div>
            )}
            {menuData && (
              <button onClick={clearMenu} className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-400/30 transition-all whitespace-nowrap">
                Clear
              </button>
            )}
            <label className="px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 transition-all cursor-pointer shadow-lg shadow-cyan-500/25 flex items-center gap-2 whitespace-nowrap">
              <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">{menuData ? 'New' : 'Upload'}</span>
              <span className="sm:hidden">+</span>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {!preview && !loading ? (
          <div className="text-center py-12 sm:py-20 px-4">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">No menu uploaded</h3>
            <p className="text-sm sm:text-base text-slate-400 mb-6 sm:mb-8">Upload a menu photo to extract items and details</p>
            <label className="inline-block px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 transition-all cursor-pointer shadow-xl shadow-cyan-500/30 text-sm sm:text-base">
              Upload Menu
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
            <p className="mt-6 text-xs text-slate-500">JPG, PNG • Max 10MB</p>
          </div>
        ) : loading ? (
          <div className="text-center py-12 sm:py-20">
            <div className="relative inline-block">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-slate-700 border-t-cyan-400 animate-spin"></div>
              <svg className="absolute inset-0 m-auto h-8 w-8 sm:h-10 sm:w-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="mt-6 sm:mt-8 text-lg sm:text-xl font-semibold text-white">Analyzing menu...</p>
            <p className="mt-2 text-sm sm:text-base text-slate-400">Extracting items</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 sm:py-20 px-4">
            <div className="mb-6 p-6 bg-red-500/10 border border-red-500/30 rounded-2xl max-w-md mx-auto">
              <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-red-400 mb-2">Analysis Failed</h3>
              <p className="text-sm text-red-300">{error}</p>
            </div>
            <label className="inline-block px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 transition-all cursor-pointer shadow-xl shadow-cyan-500/30 text-sm sm:text-base">
              Try Again
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          </div>
        ) : menuData ? (
          <div>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div><h3 className="text-sm font-semibold text-red-400">Error</h3><p className="text-sm text-red-300 mt-1">{error}</p></div>
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4 sm:p-6 shadow-2xl">
                <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <svg className="w-4 sm:w-5 h-4 sm:h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Original
                </h2>
                <div className="lg:sticky lg:top-28">
                  <img src={preview} alt="Menu" className="w-full h-auto max-h-[400px] sm:max-h-[700px] object-contain rounded-xl border border-slate-700/50 shadow-xl" />
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
                  <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                    <svg className="w-4 sm:w-5 h-4 sm:h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Digital <span className="text-xs sm:text-sm font-normal text-cyan-400">({menuData.items?.length || 0})</span>
                  </h2>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={exportJSON} className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/50 transition-all">JSON</button>
                    <button onClick={exportCSV} className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-400/30 transition-all">CSV</button>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  {Object.entries(groupedItems).map(([category, items]) => (
                    <div key={category} className="bg-slate-900/30 rounded-xl p-4 sm:p-5 border border-slate-700/30">
                      <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-cyan-500/30 flex items-center gap-2">
                        <span className="text-xl sm:text-2xl">{getCategoryIcon(category)}</span>{category}
                      </h3>
                      <div className="space-y-3 sm:space-y-4">
                        {items.map((item, idx) => {
                          const globalIdx = menuData.items.findIndex(i => i === item);
                          return (
                            <div key={idx} className="group relative bg-slate-800/30 hover:bg-slate-700/30 rounded-xl p-3 sm:p-4 border border-slate-700/50 hover:border-cyan-500/30 transition-all">
                              <button onClick={() => confirm('Delete?') && deleteItem(globalIdx)} className="absolute top-2 right-2 sm:top-3 sm:right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30">
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                              
                              <div className="flex justify-between items-start mb-2 pr-10 sm:pr-12">
                                {editingField?.itemIndex === globalIdx && editingField?.field === 'name' ? (
                                  <input type="text" defaultValue={item.name} autoFocus onBlur={(e) => { updateItemField(globalIdx, 'name', e.target.value); setEditingField(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { updateItemField(globalIdx, 'name', e.target.value); setEditingField(null); } else if (e.key === 'Escape') setEditingField(null); }} className="text-sm sm:text-base font-semibold text-white bg-slate-900/50 border-b-2 border-cyan-500 focus:outline-none w-full px-2 py-1 rounded" />
                                ) : (
                                  <h4 className="text-sm sm:text-base font-semibold text-white cursor-pointer hover:text-cyan-400 transition-colors" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'name' })}>{item.name}</h4>
                                )}
                                
                                {editingField?.itemIndex === globalIdx && editingField?.field === 'price' ? (
                                  <input type="text" defaultValue={item.price || ''} autoFocus onBlur={(e) => { updateItemField(globalIdx, 'price', e.target.value); setEditingField(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { updateItemField(globalIdx, 'price', e.target.value); setEditingField(null); } else if (e.key === 'Escape') setEditingField(null); }} className="text-base sm:text-lg font-bold text-cyan-400 bg-slate-900/50 border-b-2 border-cyan-500 focus:outline-none w-16 sm:w-20 text-right px-2 py-1 rounded" />
                                ) : (item.price && item.price.trim()) ? (
                                  <span className="text-base sm:text-lg font-bold text-cyan-400 ml-2 cursor-pointer hover:opacity-70 whitespace-nowrap" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'price' })}>{item.price}</span>
                                ) : (
                                  <span className="text-xs sm:text-sm text-slate-500 ml-2 cursor-pointer hover:text-cyan-400 italic whitespace-nowrap" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'price' })}>Add price</span>
                                )}
                              </div>
                              
                              {editingField?.itemIndex === globalIdx && editingField?.field === 'description' ? (
                                <textarea defaultValue={item.description} autoFocus onBlur={(e) => { updateItemField(globalIdx, 'description', e.target.value); setEditingField(null); }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); updateItemField(globalIdx, 'description', e.target.value); setEditingField(null); } else if (e.key === 'Escape') setEditingField(null); }} className="text-slate-300 text-xs sm:text-sm mb-2 w-full bg-slate-900/50 border border-cyan-500/50 rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500" rows={2} />
                              ) : item.description ? (
                                <p className="text-slate-400 text-xs sm:text-sm mb-2 cursor-pointer hover:text-slate-300" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'description' })}>{item.description}</p>
                              ) : (
                                <p className="text-slate-600 text-xs sm:text-sm mb-2 cursor-pointer hover:text-slate-500 italic" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'description' })}>Add description...</p>
                              )}
                              
                              {editingField?.itemIndex === globalIdx && editingField?.field === 'ingredients' ? (
                                <input type="text" defaultValue={(item.ingredients || []).join(', ')} autoFocus onBlur={(e) => { updateItemField(globalIdx, 'ingredients', e.target.value); setEditingField(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { updateItemField(globalIdx, 'ingredients', e.target.value); setEditingField(null); } else if (e.key === 'Escape') setEditingField(null); }} className="w-full text-xs text-slate-300 bg-slate-900/50 border border-cyan-500/50 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:border-cyan-500" placeholder="Comma-separated" />
                              ) : item.ingredients?.length > 0 ? (
                                <p className="text-xs text-slate-500 mb-2 cursor-pointer hover:text-slate-400" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'ingredients' })}><span className="font-medium">Ingredients:</span> {item.ingredients.join(', ')}</p>
                              ) : (
                                <p className="text-xs text-slate-600 mb-2 cursor-pointer hover:text-slate-500 italic" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'ingredients' })}>Add ingredients...</p>
                              )}
                              
                              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                {item.allergens?.map((a, i) => <span key={i} className="bg-red-500/20 text-red-400 text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-medium cursor-pointer hover:bg-red-500/30 border border-red-400/30" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'tags' })}>⚠️ {a}</span>)}
                                {item.dietary?.map((d, i) => <span key={i} className="bg-emerald-500/20 text-emerald-400 text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-medium cursor-pointer hover:bg-emerald-500/30 border border-emerald-400/30" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'tags' })}>✓ {d}</span>)}
                                {(!item.allergens?.length && !item.dietary?.length) && <span onClick={() => setEditingField({ itemIndex: globalIdx, field: 'tags' })} className="text-xs text-slate-600 hover:text-cyan-400 cursor-pointer italic">Add tags...</span>}
                              </div>
                              
                              {editingField?.itemIndex === globalIdx && editingField?.field === 'tags' && (
                                <div className="mt-3 p-3 sm:p-4 bg-slate-900/50 rounded-xl border border-cyan-500/30">
                                  <div className="mb-3">
                                    <label className="text-xs font-medium text-slate-400 block mb-2">Allergens</label>
                                    <input type="text" defaultValue={(item.allergens || []).join(', ')} onBlur={(e) => updateItemField(globalIdx, 'allergens', e.target.value)} className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg focus:outline-none focus:border-cyan-500 text-slate-300" placeholder="nuts, dairy" />
                                  </div>
                                  <div className="mb-3">
                                    <label className="text-xs font-medium text-slate-400 block mb-2">Dietary</label>
                                    <input type="text" defaultValue={(item.dietary || []).join(', ')} onBlur={(e) => updateItemField(globalIdx, 'dietary', e.target.value)} className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg focus:outline-none focus:border-cyan-500 text-slate-300" placeholder="vegan, vegetarian" />
                                  </div>
                                  <button onClick={() => setEditingField(null)} className="text-xs sm:text-sm bg-cyan-500/20 text-cyan-400 px-4 py-2 rounded-lg hover:bg-cyan-500/30 border border-cyan-400/30 font-medium">Done</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}