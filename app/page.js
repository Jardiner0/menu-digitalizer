'use client';
import { useState, useCallback, useMemo } from 'react';

// --- Configuration ---
const MAX_FILE_SIZE_MB = 5; // Max allowed file size
const MAX_IMAGE_DIMENSION = 1200; // Resize image to max 1200px on the longest side

// --- Helper Functions ---

const resizeImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        let scale = 1;

        if (width > height && width > MAX_IMAGE_DIMENSION) {
          scale = MAX_IMAGE_DIMENSION / width;
        } else if (height > width && height > MAX_IMAGE_DIMENSION) {
          scale = MAX_IMAGE_DIMENSION / height;
        } else if (width === height && width > MAX_IMAGE_DIMENSION) {
            scale = MAX_IMAGE_DIMENSION / width;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};

const getCategoryIcon = (category) => {
  const map = {
    'appetizer': '🍤',
    'main': '🥩',
    'dessert': '🍰',
    'beverage': '🍹',
    'breakfast': '🍳',
    'lunch': '🥪',
    'side': '🍟',
    'salad': '🥗',
    'soup': '🍜',
    'default': '🍽️',
  };
  const key = category ? category.toLowerCase().split(' ')[0] : 'default';
  return map[key] || map.default;
};

// --- Main Component ---

export default function Home() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [menuData, setMenuData] = useState(null);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState({ globalIndex: null, field: null });
  const [showTagsInput, setShowTagsInput] = useState(null);

  // --- Core Logic ---

  const handleAPIRequest = useCallback(async (base64Image, type, name) => {
    setLoading(true);
    setError(null);
    setFileName(name);
    try {
      const response = await fetch('/api/analyze-menu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          mediaType: type,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(`[API Error]: ${errData.details || errData.error || 'Menu analysis failed on the server.'}`);
      }

      const data = await response.json();
      setMenuData(data.menu);
    } catch (err) {
      setError(err.message || 'An unknown error occurred during analysis.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImageChange = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (menuData && !window.confirm("A menu already exists. Are you sure you want to upload a new one and replace the current data?")) {
      return;
    }
    
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size exceeds ${MAX_FILE_SIZE_MB}MB. Please upload a smaller image.`);
      return;
    }

    setLoading(true);

    try {
      const dataUrl = await resizeImage(file);
      const base64Image = dataUrl.split(',')[1];
      const mediaType = dataUrl.split(';')[0].split(':')[1];

      setImage(dataUrl); 
      
      await handleAPIRequest(base64Image, mediaType, file.name);

    } catch (err) {
      setError('Error processing image for upload.');
    } finally {
        setLoading(false);
    }
  }, [menuData, handleAPIRequest]);

  // --- Editing/Updating/Clearing Menu ---

  const updateMenuData = useCallback((newMenu) => {
    setIsSaving(true);
    setMenuData(newMenu);
    setTimeout(() => setIsSaving(false), 500);
  }, []);

  const updateItemField = useCallback((globalIndex, field, value) => {
    const newMenu = { ...menuData };
    let currentIndex = 0;
    
    for (const category of newMenu.items) {
      for (const item of category.items) {
        if (currentIndex === globalIndex) {
          
          let updatedValue = value.trim();

          if (field === 'price') {
             if (updatedValue === '') {
                 updatedValue = '';
             } else {
                 updatedValue = updatedValue.startsWith('$') ? updatedValue : `$${updatedValue}`;
             }
          }

          if (['ingredients', 'allergens', 'dietary'].includes(field)) {
            updatedValue = updatedValue.split(',').map(s => s.trim()).filter(s => s);
          }

          item[field] = updatedValue;
          updateMenuData(newMenu);
          setEditingItem({ globalIndex: null, field: null });
          setShowTagsInput(null);
          return;
        }
        currentIndex++;
      }
    }
  }, [menuData, updateMenuData]);

  const deleteItem = useCallback((globalIndex) => {
    if (!window.confirm("Are you sure you want to delete this menu item?")) return;

    const newMenu = { ...menuData };
    let currentIndex = 0;
    let categoryIndexToDelete = -1;
    let itemIndexToDelete = -1;

    for (let catIndex = 0; catIndex < newMenu.items.length; catIndex++) {
        const category = newMenu.items[catIndex];
        for (let itemIndex = 0; itemIndex < category.items.length; itemIndex++) {
            if (currentIndex === globalIndex) {
                categoryIndexToDelete = catIndex;
                itemIndexToDelete = itemIndex;
                break;
            }
            currentIndex++;
        }
        if (itemIndexToDelete !== -1) break;
    }

    if (itemIndexToDelete !== -1) {
        newMenu.items[categoryIndexToDelete].items.splice(itemIndexToDelete, 1);
        
        if (newMenu.items[categoryIndexToDelete].items.length === 0) {
            newMenu.items.splice(categoryIndexToDelete, 1);
        }

        updateMenuData(newMenu);
    }
  }, [menuData, updateMenuData]);


  const clearMenu = useCallback(() => {
    if (window.confirm("Are you sure you want to clear the current menu data and image?")) {
      setImage(null);
      setMenuData(null);
      setError(null);
      setFileName(null);
    }
  }, [clearMenu]);


  // --- Calculation Logic (Simplified and Hardened) ---
  
  const categorizedItems = useMemo(() => {
    const categories = {};
    let globalIndex = 0;

    if (menuData?.items && Array.isArray(menuData.items)) { 
      menuData.items.forEach(cat => {
        const name = cat.category_name || 'Uncategorized';
        
        const validItems = Array.isArray(cat.items) ? cat.items : []; 
        
        categories[name] = {
          name: name,
          icon: getCategoryIcon(name),
          items: validItems.map(item => ({
            ...item,
            globalIndex: globalIndex++,
          }))
        };
      });
    }

    return Object.values(categories);

  }, [menuData]);


  const totalItems = useMemo(() => {
      // FIX: Rely on direct checking of menuData to avoid issues during initial render
      if (!menuData || !menuData.items || !Array.isArray(menuData.items)) {
          return 0;
      }
      return menuData.items.reduce((count, category) => {
          return count + (Array.isArray(category.items) ? category.items.length : 0);
      }, 0);
  }, [menuData]);


  // --- Render Components ---

  const renderEditable = (globalIndex, field, value, type = 'input', placeholder = '') => {
    const isEditing = editingItem.globalIndex === globalIndex && editingItem.field === field;
    const isPrice = field === 'price';
    const isDescription = field === 'description';
    
    const displayValue = isPrice && typeof value === 'string' ? value.trim() : value;
    const hasPrice = isPrice && displayValue && displayValue !== '';


    const handleKeyDown = (e) => {
        if (isDescription && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.target.blur();
        } else if (!isDescription && e.key === 'Enter') {
            e.target.blur();
        }
    };

    if (isEditing) {
      const Element = type === 'textarea' ? 'textarea' : 'input';
      return (
        <Element
          type={isPrice ? 'text' : 'text'}
          defaultValue={value || ''}
          placeholder={placeholder}
          onBlur={(e) => updateItemField(globalIndex, field, e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className={`w-full ${isPrice ? 'text-lg font-bold' : isDescription ? 'text-sm' : 'text-md font-semibold'} bg-slate-700/80 border border-cyan-500 rounded px-2 py-1 focus:outline-none text-white transition-all duration-150`}
        />
      );
    }

    return (
      <span 
        onClick={() => setEditingItem({ globalIndex, field })} 
        className={`cursor-pointer hover:bg-slate-700/50 rounded transition-all duration-150 p-1 -m-1 ${isPrice && !hasPrice ? 'text-slate-400 italic text-sm' : isPrice ? 'text-cyan-400 font-bold text-lg' : 'text-white'}`}
        title={`Click to edit ${field}`}
      >
        {hasPrice ? displayValue : (isPrice ? 'Add price' : `Add ${field}`)}
      </span>
    );
  };

  const renderTagsInput = (globalIndex) => {
    const item = categorizedItems.flatMap(c => c.items).find(i => i.globalIndex === globalIndex);
    if (!item) return null;

    const isEditing = showTagsInput === globalIndex;
    const allergensValue = (item.allergens || []).join(', ');
    const dietaryValue = (item.dietary || []).join(', ');

    if (!isEditing) {
        return null;
    }

    return (
        <div className="space-y-3 p-3 bg-slate-800/70 rounded-xl mt-3 border border-slate-700">
            <h4 className="text-xs font-semibold text-cyan-400">Edit Allergens (comma-separated)</h4>
            <input
                type="text"
                defaultValue={allergensValue}
                onBlur={(e) => updateItemField(globalIndex, 'allergens', e.target.value)}
                className="w-full text-sm px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg focus:outline-none focus:border-cyan-500 text-slate-300"
                placeholder="nuts, dairy, gluten"
            />
            <h4 className="text-xs font-semibold text-cyan-400 mt-4">Edit Dietary Tags (comma-separated)</h4>
            <input
                type="text"
                defaultValue={dietaryValue}
                onBlur={(e) => updateItemField(globalIndex, 'dietary', e.target.value)}
                className="w-full text-sm px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg focus:outline-none focus:border-cyan-500 text-slate-300"
                placeholder="vegan, vegetarian, gluten-free"
            />
            <button 
                onClick={() => setShowTagsInput(null)} 
                className="mt-3 w-full py-1 text-sm text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors duration-150"
            >
                Done
            </button>
        </div>
    );
};

  const renderTags = (tags, colorClass, globalIndex) => tags.map((tag, index) => (
    <span 
        key={index} 
        onClick={() => setShowTagsInput(showTagsInput !== globalIndex ? globalIndex : null)}
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass} cursor-pointer transition-opacity duration-150 hover:opacity-80`}
    >
        {tag}
    </span>
  ));

  const downloadFile = (data, filename, type) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const filename = `${(menuData?.restaurant_name || 'menu')}_data.json`;
    downloadFile(JSON.stringify(menuData, null, 2), filename, 'application/json');
  };

  const exportCSV = () => {
    const header = [
      "Category",
      "Item Name",
      "Price",
      "Description",
      "Ingredients",
      "Allergens",
      "Dietary Tags",
    ].join(',');
    
    const rows = menuData.items.flatMap(category => 
      category.items.map(item => [
        `"${category.category_name}"`,
        `"${item.name ? item.name.replace(/"/g, '""') : ''}"`,
        `"${item.price ? item.price.replace(/"/g, '""') : ''}"`,
        `"${item.description ? item.description.replace(/"/g, '""') : ''}"`,
        `"${(item.ingredients || []).join('; ').replace(/"/g, '""')}"`,
        `"${(item.allergens || []).join('; ').replace(/"/g, '""')}"`,
        `"${(item.dietary || []).join('; ').replace(/"/g, '""')}"`,
      ].join(','))
    );
    
    const csvContent = [header, ...rows].join('\n');
    const filename = `${(menuData?.restaurant_name || 'menu')}_data.csv`;
    downloadFile(csvContent, filename, 'text/csv');
  };

  // --- Rendering UI Sections ---

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center text-center p-12 space-y-4 bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl">
      <h2 className="text-2xl font-extrabold text-white">
        Digitize Your Restaurant Menu 
      </h2>
      <p className="text-slate-400 max-w-md">
        Upload a photo of your physical menu, and our AI will extract all items, prices, and details instantly.
      </p>
      <div className="flex items-center space-x-2 text-sm text-slate-500">
        <span className="font-semibold">Supported formats:</span>
        <span className="bg-slate-700/50 px-2 py-1 rounded-md">JPG, PNG</span>
        <span className="bg-slate-700/50 px-2 py-1 rounded-md">Max 5MB (resized on upload)</span>
      </div>
      <label className="cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transform hover:scale-105 transition duration-200 ease-in-out">
        Upload Menu Photo
        <input type="file" onChange={handleImageChange} accept="image/*" className="hidden" />
      </label>
    </div>
  );

  const renderLoadingState = () => (
    <div className="flex flex-col items-center justify-center text-center p-12 space-y-4 bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/20">
            <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 015 12c0-2.137.893-4.085 2.343-5.556L7.707 7.707A6.002 6.002 0 006 12c0 2.21 1.79 4 4 4h-1.586l-1.05-1.05A8.003 8.003 0 016 17.291z"></path>
            </svg>
        </div>
        <h2 className="text-xl font-bold text-white">
            Analyzing Menu...
        </h2>
        <p className="text-slate-400">
            AI is extracting items, prices, descriptions, and tags. This can take up to 30 seconds.
        </p>
    </div>
  );


  const renderMenuData = () => (
    <div className="w-full">
        {error && (
            <div className="bg-red-900/40 border border-red-700/60 text-red-300 px-6 py-4 rounded-xl mb-6 flex items-center gap-3 shadow-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.332 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div className="font-semibold">{error}</div>
            </div>
        )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start w-full">
        {/* Left Side: Original Image */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl p-4 border border-slate-700/50">
            <h2 className="text-lg font-bold text-white mb-3">Original Menu</h2>
            <div className="md:sticky md:top-24">
              {image ? (
                <img 
                  alt="Original menu" 
                  src={image} 
                  className="w-full h-auto max-h-[800px] object-contain rounded-lg border border-slate-700 shadow-md"
                />
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-500 bg-slate-700/30 rounded-lg">No image uploaded.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Digital Menu Data */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl p-4 border border-slate-700/50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">
                Digital Menu <span className="text-cyan-400 text-sm font-normal">({totalItems} items)</span>
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={exportCSV}
                  className="text-xs font-semibold px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition duration-150"
                  title="Download as spreadsheet"
                >
                  Export CSV
                </button>
                <button
                  onClick={exportJSON}
                  className="text-xs font-semibold px-3 py-1 rounded-lg bg-slate-600/20 text-slate-300 border border-slate-500/30 hover:bg-slate-600/30 transition duration-150"
                  title="Download raw structured data"
                >
                  Export JSON
                </button>
              </div>
            </div>

            {totalItems === 0 && (
                <div className="text-center py-6 text-slate-400 italic">No menu items were extracted.</div>
            )}
            
            <div className="space-y-8">
              {categorizedItems.map(category => (
                <div key={category.name} className="border-l-4 border-cyan-500 pl-4 space-y-6">
                  <h3 className="text-2xl font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="text-3xl">{category.icon}</span> 
                    {category.name}
                  </h3>
                  <div className="space-y-6">
                    {category.items.map((item) => {
                      const globalIndex = item.globalIndex;
                      const hasTags = (item.allergens?.length > 0 || item.dietary?.length > 0);
                      
                      return (
                        <div key={globalIndex} className="relative bg-slate-900/40 p-4 rounded-xl border border-slate-700 shadow-xl group hover:shadow-cyan-500/20 transition-all duration-300">
                          
                          {/* Item Header: Name and Price */}
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col max-w-[calc(100%-100px)]">
                              {renderEditable(globalIndex, 'name', item.name, 'input', 'Dish Name')}
                            </div>
                            <div className="flex-shrink-0">
                                {renderEditable(globalIndex, 'price', item.price, 'input', 'Add price')}
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-slate-400 mb-3">
                            {renderEditable(globalIndex, 'description', item.description, 'textarea', 'Description (e.g., house-made pasta with pesto)')}
                          </p>

                          {/* Ingredients */}
                          <div className="text-xs text-slate-400 mb-3">
                            <span className="font-semibold text-slate-300 mr-2">Ingredients:</span>
                            {renderEditable(globalIndex, 'ingredients', (item.ingredients || []).join(', '), 'input', 'tomatoes, basil, mozzarella')}
                          </div>

                          {/* Tags Section */}
                          <div className="flex flex-wrap gap-2 items-center" onClick={() => setShowTagsInput(showTagsInput !== globalIndex ? globalIndex : null)}>
                                {item.allergens && renderTags(item.allergens, 'bg-red-500/20 text-red-300 border border-red-500/30', globalIndex)}
                                {item.dietary && renderTags(item.dietary, 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30', globalIndex)}
                                
                                {!hasTags && (
                                    <span className="text-xs italic text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors duration-150">
                                        No tags added. Click to add.
                                    </span>
                                )}
                          </div>
                          
                          {showTagsInput === globalIndex && renderTagsInput(globalIndex)}

                          {/* Controls (Edit/Delete) */}
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                            <button
                              onClick={() => setEditingItem({ globalIndex: globalIndex, field: 'name' })}
                              className="bg-cyan-600/50 text-white p-1.5 rounded-lg hover:bg-cyan-600 transition duration-150 text-xs flex items-center gap-1"
                              title="Full Edit"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              Edit
                            </button>
                            <button
                              onClick={() => deleteItem(globalIndex)}
                              className="bg-red-600/50 text-white p-1.5 rounded-lg hover:bg-red-600 transition duration-150 text-xs flex items-center gap-1"
                              title="Delete Item"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.86 12.316A2 2 0 0116.14 21H7.86a2 2 0 01-1.996-1.684L5 7m5 4v6m4-6v6m1-10H8" /></svg>
                              Delete
                            </button>
                          </div>
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
    </div>
  );
  
  // --- Main Render ---

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          
          {/* Logo and Title */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Menu Digitalizer</h1>
                {menuData?.restaurant_name && <p className="text-sm text-cyan-400">{menuData.restaurant_name}</p>}
              </div>
            </div>
            {fileName && <p className="text-xs text-slate-400 mt-2 ml-13">📄 {fileName}</p>}
          </div>

          {/* Controls and Status */}
          <div className="flex items-center gap-3">
            {isSaving && (
              <div className="flex items-center gap-2 bg-emerald-500/20 px-4 py-1.5 rounded-xl border border-emerald-400/30 transform transition duration-500">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-emerald-400">Saved</span>
              </div>
            )}
            
            <button
              onClick={clearMenu}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 border border-red-600/30 hover:bg-red-600/40 transition duration-150"
              title="Clear all data"
            >
              Clear Menu
            </button>
            
            <label className="cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-2.5 px-5 rounded-lg shadow-lg transform hover:scale-105 transition duration-200 ease-in-out text-sm">
              Upload New
              <input type="file" onChange={handleImageChange} accept="image/*" className="hidden" />
            </label>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-center w-full">
          {loading ? renderLoadingState() : menuData ? renderMenuData() : renderEmptyState()}
        </div>
      </main>
      
      <footer className="w-full text-center py-4 text-xs text-slate-600 border-t border-slate-800">
        Powered by Next.js & Claude AI
      </footer>
    </div>
  );
}