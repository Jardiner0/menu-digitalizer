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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400">
      <header className="bg-white shadow-lg sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Menu Digitalizer</h1>
                {menuData?.restaurant_name && <p className="text-sm sm:text-base text-blue-600 font-medium">{menuData.restaurant_name}</p>}
              </div>
            </div>
            {fileName && <p className="text-xs text-gray-500 mt-2 ml-15 truncate max-w-[200px] sm:max-w-none">📄 {fileName}</p>}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            {isSaving && (
              <div className="flex items-center gap-2 bg-green-500 px-3 sm:px-4 py-2 rounded-xl shadow-lg animate-pulse">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs sm:text-sm font-semibold text-white hidden sm:inline">Saved</span>
              </div>
            )}
            {menuData && (
              <button onClick={clearMenu} className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-red-600 hover:bg-red-50 border-2 border-red-200 hover:border-red-300 transition-all whitespace-nowrap">
                Clear
              </button>
            )}
            <label className="px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400 transition-all cursor-pointer shadow-lg hover:shadow-xl flex items-center gap-2 whitespace-nowrap">
              <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">{menuData ? 'New Menu' : 'Upload Menu'}</span>
              <span className="sm:hidden">+</span>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {!preview && !loading ? (
          <div className="text-center py-12 sm:py-20 px-4">
            <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-8 sm:p-12">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">No menu uploaded</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-8">Upload a menu photo to extract items and details</p>
              <label className="inline-block px-8 sm:px-10 py-4 rounded-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400 transition-all cursor-pointer shadow-xl hover:shadow-2xl text-base sm:text-lg">
                Upload Menu
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              <p className="mt-6 text-xs text-gray-400">JPG, PNG • Max 10MB</p>
            </div>
          </div>
        ) : loading ? (
          <div className="text-center py-12 sm:py-20">
            <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-8 sm:p-12">
              <div className="relative inline-block mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin"></div>
              </div>
              <p className="mt-6 sm:mt-8 text-xl sm:text-2xl font-bold text-gray-900">Analyzing menu...</p>
              <p className="mt-2 text-sm sm:text-base text-gray-500">Extracting items with AI</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12 sm:py-20 px-4">
            <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-8 sm:p-12">
              <div className="w-20 h-20 mx-auto bg-red-100 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Analysis Failed</h3>
              <p className="text-sm text-gray-600 mb-8">{error}</p>
              <label className="inline-block px-8 sm:px-10 py-4 rounded-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400 transition-all cursor-pointer shadow-xl hover:shadow-2xl">
                Try Again
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            </div>
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
              <div className="bg-white rounded-3xl shadow-2xl p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4">
                  Original Menu
                </h2>
                <div className="lg:sticky lg:top-28">
                  <img src={preview} alt="Menu" className="w-full h-auto max-h-[400px] sm:max-h-[700px] object-contain rounded-2xl shadow-lg" />
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-2xl p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    Digital Menu <span className="text-xs sm:text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">{menuData.items?.length || 0} items</span>
                  </h2>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={exportJSON} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all">JSON</button>
                    <button onClick={exportCSV} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 transition-all shadow-md">CSV</button>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  {Object.entries(groupedItems).map(([category, items]) => (
                    <div key={category} className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-4 sm:p-5 border border-gray-200">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b-2 border-blue-200 flex items-center gap-2">
                        <span className="text-xl sm:text-2xl">{getCategoryIcon(category)}</span>
                        <span>{category}</span>
                      </h3>
                      </h3>
                      <div className="space-y-3 sm:space-y-4">
                        {items.map((item, idx) => {
                          const globalIdx = menuData.items.findIndex(i => i === item);
                          return (
                            <div key={idx} className="group relative bg-white hover:bg-blue-50 rounded-2xl p-3 sm:p-4 border-2 border-gray-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md">
                              <button onClick={() => confirm('Delete?') && deleteItem(globalIdx)} className="absolute top-2 right-2 sm:top-3 sm:right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                              
                              <div className="flex justify-between items-start mb-2 pr-10 sm:pr-12">
                                {editingField?.itemIndex === globalIdx && editingField?.field === 'name' ? (
                                  <input type="text" defaultValue={item.name} autoFocus onBlur={(e) => { updateItemField(globalIdx, 'name', e.target.value); setEditingField(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { updateItemField(globalIdx, 'name', e.target.value); setEditingField(null); } else if (e.key === 'Escape') setEditingField(null); }} className="text-sm sm:text-base font-bold text-gray-900 bg-blue-50 border-b-2 border-blue-500 focus:outline-none w-full px-2 py-1 rounded" />
                                ) : (
                                  <h4 className="text-sm sm:text-base font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'name' })}>{item.name}</h4>
                                )}
                                
                                {editingField?.itemIndex === globalIdx && editingField?.field === 'price' ? (
                                  <input type="text" defaultValue={item.price || ''} autoFocus onBlur={(e) => { updateItemField(globalIdx, 'price', e.target.value); setEditingField(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { updateItemField(globalIdx, 'price', e.target.value); setEditingField(null); } else if (e.key === 'Escape') setEditingField(null); }} className="text-base sm:text-lg font-bold text-blue-600 bg-blue-50 border-b-2 border-blue-500 focus:outline-none w-16 sm:w-20 text-right px-2 py-1 rounded" />
                                ) : (item.price && item.price.trim()) ? (
                                  <span className="text-base sm:text-lg font-bold text-blue-600 ml-2 cursor-pointer hover:opacity-70 whitespace-nowrap" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'price' })}>{item.price}</span>
                                ) : (
                                  <span className="text-xs sm:text-sm text-gray-400 ml-2 cursor-pointer hover:text-blue-500 italic whitespace-nowrap" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'price' })}>Add price</span>
                                )}
                              </div>
                              
                              {editingField?.itemIndex === globalIdx && editingField?.field === 'description' ? (
                                <textarea defaultValue={item.description} autoFocus onBlur={(e) => { updateItemField(globalIdx, 'description', e.target.value); setEditingField(null); }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); updateItemField(globalIdx, 'description', e.target.value); setEditingField(null); } else if (e.key === 'Escape') setEditingField(null); }} className="text-gray-700 text-xs sm:text-sm mb-2 w-full bg-blue-50 border-2 border-blue-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500" rows={2} />
                              ) : item.description ? (
                                <p className="text-gray-600 text-xs sm:text-sm mb-2 cursor-pointer hover:text-gray-800" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'description' })}>{item.description}</p>
                              ) : (
                                <p className="text-gray-400 text-xs sm:text-sm mb-2 cursor-pointer hover:text-gray-500 italic" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'description' })}>Add description...</p>
                              )}
                              
                              {editingField?.itemIndex === globalIdx && editingField?.field === 'ingredients' ? (
                                <input type="text" defaultValue={(item.ingredients || []).join(', ')} autoFocus onBlur={(e) => { updateItemField(globalIdx, 'ingredients', e.target.value); setEditingField(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { updateItemField(globalIdx, 'ingredients', e.target.value); setEditingField(null); } else if (e.key === 'Escape') setEditingField(null); }} className="w-full text-xs text-gray-700 bg-blue-50 border-2 border-blue-300 rounded-xl px-3 py-2 mb-2 focus:outline-none focus:border-blue-500" placeholder="Comma-separated" />
                              ) : item.ingredients?.length > 0 ? (
                                <p className="text-xs text-gray-500 mb-2 cursor-pointer hover:text-gray-700" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'ingredients' })}><span className="font-semibold">Ingredients:</span> {item.ingredients.join(', ')}</p>
                              ) : (
                                <p className="text-xs text-gray-400 mb-2 cursor-pointer hover:text-gray-500 italic" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'ingredients' })}>Add ingredients...</p>
                              )}
                              
                              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                {item.allergens?.map((a, i) => <span key={i} className="bg-red-100 text-red-600 text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-semibold cursor-pointer hover:bg-red-200 border border-red-200" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'tags' })}>⚠️ {a}</span>)}
                                {item.dietary?.map((d, i) => <span key={i} className="bg-green-100 text-green-600 text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-semibold cursor-pointer hover:bg-green-200 border border-green-200" onClick={() => setEditingField({ itemIndex: globalIdx, field: 'tags' })}>✓ {d}</span>)}
                                {(!item.allergens?.length && !item.dietary?.length) && <span onClick={() => setEditingField({ itemIndex: globalIdx, field: 'tags' })} className="text-xs text-gray-400 hover:text-blue-500 cursor-pointer italic">Add tags...</span>}
                              </div>
                              
                              {editingField?.itemIndex === globalIdx && editingField?.field === 'tags' && (
                                <div className="mt-3 p-3 sm:p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                                  <div className="mb-3">
                                    <label className="text-xs font-semibold text-gray-700 block mb-2">Allergens</label>
                                    <input type="text" defaultValue={(item.allergens || []).join(', ')} onBlur={(e) => updateItemField(globalIdx, 'allergens', e.target.value)} className="w-full text-xs sm:text-sm px-3 py-2 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-gray-700" placeholder="nuts, dairy" />
                                  </div>
                                  <div className="mb-3">
                                    <label className="text-xs font-semibold text-gray-700 block mb-2">Dietary</label>
                                    <input type="text" defaultValue={(item.dietary || []).join(', ')} onBlur={(e) => updateItemField(globalIdx, 'dietary', e.target.value)} className="w-full text-xs sm:text-sm px-3 py-2 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-gray-700" placeholder="vegan, vegetarian" />
                                  </div>
                                  <button onClick={() => setEditingField(null)} className="text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-4 py-2 rounded-xl hover:from-blue-500 hover:to-cyan-400 font-bold shadow-md">Done</button>
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