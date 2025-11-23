/**
 * Admin Component: Tone Editor
 *
 * Modal editor for creating/editing roast tones with multilanguage support.
 *
 * Issue #876: Dynamic Roast Tone Configuration System
 */

import React, { useState, useEffect } from 'react';

const ToneEditor = ({ tone, onSave, onClose }) => {
  const [activeTab, setActiveTab] = useState('es');
  const [formData, setFormData] = useState({
    name: '',
    display_name: { es: '', en: '' },
    description: { es: '', en: '' },
    intensity: 3,
    personality: '',
    resources: [''],
    restrictions: [''],
    examples: [{ es: { input: '', output: '' }, en: { input: '', output: '' } }],
    active: true,
    is_default: false
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (tone) {
      setFormData({
        name: tone.name || '',
        display_name: tone.display_name || { es: '', en: '' },
        description: tone.description || { es: '', en: '' },
        intensity: tone.intensity || 3,
        personality: tone.personality || '',
        resources: tone.resources && tone.resources.length > 0 ? tone.resources : [''],
        restrictions: tone.restrictions && tone.restrictions.length > 0 ? tone.restrictions : [''],
        examples:
          tone.examples && tone.examples.length > 0
            ? tone.examples
            : [{ es: { input: '', output: '' }, en: { input: '', output: '' } }],
        active: tone.active !== undefined ? tone.active : true,
        is_default: tone.is_default || false
      });
    }
  }, [tone]);

  const validate = () => {
    const newErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'El identificador es requerido';
    } else if (!/^[a-z0-9_-]+$/.test(formData.name)) {
      newErrors.name = 'Solo minúsculas, números, guiones y guiones bajos';
    }

    // Display name validation
    if (!formData.display_name.es.trim()) {
      newErrors.display_name_es = 'Nombre en español es requerido';
    }
    if (!formData.display_name.en.trim()) {
      newErrors.display_name_en = 'Nombre en inglés es requerido';
    }

    // Description validation
    if (!formData.description.es.trim()) {
      newErrors.description_es = 'Descripción en español es requerida';
    }
    if (!formData.description.en.trim()) {
      newErrors.description_en = 'Descripción en inglés es requerida';
    }

    // Personality validation
    if (!formData.personality.trim()) {
      newErrors.personality = 'La personalidad es requerida';
    }

    // Resources validation
    const validResources = formData.resources.filter((r) => r.trim());
    if (validResources.length === 0) {
      newErrors.resources = 'Al menos un recurso es requerido';
    }

    // Restrictions validation
    const validRestrictions = formData.restrictions.filter((r) => r.trim());
    if (validRestrictions.length === 0) {
      newErrors.restrictions = 'Al menos una restricción es requerida';
    }

    // Examples validation
    const validExamples = formData.examples.filter(
      (ex) => ex.es.input.trim() && ex.es.output.trim() && ex.en.input.trim() && ex.en.output.trim()
    );
    if (validExamples.length === 0) {
      newErrors.examples = 'Al menos un ejemplo completo (ES/EN) es requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Clean up data before sending
    const cleanedData = {
      ...formData,
      resources: formData.resources.filter((r) => r.trim()),
      restrictions: formData.restrictions.filter((r) => r.trim()),
      examples: formData.examples.filter(
        (ex) =>
          ex.es.input.trim() && ex.es.output.trim() && ex.en.input.trim() && ex.en.output.trim()
      )
    };

    onSave(cleanedData);
  };

  const addResource = () => {
    setFormData({
      ...formData,
      resources: [...formData.resources, '']
    });
  };

  const removeResource = (index) => {
    if (formData.resources.length > 1) {
      setFormData({
        ...formData,
        resources: formData.resources.filter((_, i) => i !== index)
      });
    }
  };

  const updateResource = (index, value) => {
    const newResources = [...formData.resources];
    newResources[index] = value;
    setFormData({ ...formData, resources: newResources });
  };

  const addRestriction = () => {
    setFormData({
      ...formData,
      restrictions: [...formData.restrictions, '']
    });
  };

  const removeRestriction = (index) => {
    if (formData.restrictions.length > 1) {
      setFormData({
        ...formData,
        restrictions: formData.restrictions.filter((_, i) => i !== index)
      });
    }
  };

  const updateRestriction = (index, value) => {
    const newRestrictions = [...formData.restrictions];
    newRestrictions[index] = value;
    setFormData({ ...formData, restrictions: newRestrictions });
  };

  const addExample = () => {
    setFormData({
      ...formData,
      examples: [
        ...formData.examples,
        { es: { input: '', output: '' }, en: { input: '', output: '' } }
      ]
    });
  };

  const removeExample = (index) => {
    if (formData.examples.length > 1) {
      setFormData({
        ...formData,
        examples: formData.examples.filter((_, i) => i !== index)
      });
    }
  };

  const updateExample = (index, lang, field, value) => {
    const newExamples = [...formData.examples];
    newExamples[index][lang][field] = value;
    setFormData({ ...formData, examples: newExamples });
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 sm:px-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  {tone ? 'Editar Tono' : 'Crear Nuevo Tono'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-4 py-5 sm:p-6 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="space-y-6 mb-8">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Identificador * <span className="text-xs text-gray-500">(ej: tono_custom)</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value.toLowerCase() })
                    }
                    disabled={!!tone}
                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                      errors.name
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:border-red-500 focus:ring-red-500'
                    } dark:bg-gray-700 dark:text-white ${tone ? 'bg-gray-100 dark:bg-gray-900' : ''}`}
                    placeholder="nombre_del_tono"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                <div>
                  <label
                    htmlFor="intensity"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Intensidad * (1 = ligero, 5 = salvaje)
                  </label>
                  <div className="mt-2 flex items-center space-x-4">
                    <input
                      type="range"
                      id="intensity"
                      min="1"
                      max="5"
                      value={formData.intensity}
                      onChange={(e) =>
                        setFormData({ ...formData, intensity: parseInt(e.target.value) })
                      }
                      className="flex-1"
                    />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formData.intensity}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {'⭐'.repeat(formData.intensity)} {formData.intensity === 1 && '(Muy suave)'}{' '}
                    {formData.intensity === 5 && '(Muy intenso)'}
                  </div>
                </div>
              </div>

              {/* Language Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    type="button"
                    onClick={() => setActiveTab('es')}
                    className={`${
                      activeTab === 'es'
                        ? 'border-red-500 text-red-600 dark:text-red-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    🇪🇸 Español
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('en')}
                    className={`${
                      activeTab === 'en'
                        ? 'border-red-500 text-red-600 dark:text-red-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    🇬🇧 English
                  </button>
                </nav>
              </div>

              {/* Spanish Tab */}
              {activeTab === 'es' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nombre (Español) *
                    </label>
                    <input
                      type="text"
                      value={formData.display_name.es}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          display_name: { ...formData.display_name, es: e.target.value }
                        })
                      }
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.display_name_es
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:border-red-500 focus:ring-red-500'
                      } dark:bg-gray-700 dark:text-white`}
                      placeholder="Ej: Flanders, Balanceado, Canalla"
                    />
                    {errors.display_name_es && (
                      <p className="mt-1 text-sm text-red-600">{errors.display_name_es}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Descripción (Español) *
                    </label>
                    <textarea
                      value={formData.description.es}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: { ...formData.description, es: e.target.value }
                        })
                      }
                      rows={3}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.description_es
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:border-red-500 focus:ring-red-500'
                      } dark:bg-gray-700 dark:text-white`}
                      placeholder="Descripción del tono en español..."
                    />
                    {errors.description_es && (
                      <p className="mt-1 text-sm text-red-600">{errors.description_es}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ejemplos (Español) *
                    </label>
                    {formData.examples.map((example, index) => (
                      <div
                        key={index}
                        className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Ejemplo {index + 1}
                          </span>
                          {formData.examples.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeExample(index)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400"
                            >
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={example.es.input}
                          onChange={(e) => updateExample(index, 'es', 'input', e.target.value)}
                          className="mb-2 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                          placeholder="Input: Comentario tóxico de ejemplo"
                        />
                        <textarea
                          value={example.es.output}
                          onChange={(e) => updateExample(index, 'es', 'output', e.target.value)}
                          rows={2}
                          className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                          placeholder="Output: Roast generado de ejemplo"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addExample}
                      className="text-sm text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      + Añadir ejemplo
                    </button>
                    {errors.examples && (
                      <p className="mt-1 text-sm text-red-600">{errors.examples}</p>
                    )}
                  </div>
                </div>
              )}

              {/* English Tab */}
              {activeTab === 'en' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Name (English) *
                    </label>
                    <input
                      type="text"
                      value={formData.display_name.en}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          display_name: { ...formData.display_name, en: e.target.value }
                        })
                      }
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.display_name_en
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:border-red-500 focus:ring-red-500'
                      } dark:bg-gray-700 dark:text-white`}
                      placeholder="Ex: Light, Balanced, Savage"
                    />
                    {errors.display_name_en && (
                      <p className="mt-1 text-sm text-red-600">{errors.display_name_en}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description (English) *
                    </label>
                    <textarea
                      value={formData.description.en}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: { ...formData.description, en: e.target.value }
                        })
                      }
                      rows={3}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.description_en
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:border-red-500 focus:ring-red-500'
                      } dark:bg-gray-700 dark:text-white`}
                      placeholder="Tone description in English..."
                    />
                    {errors.description_en && (
                      <p className="mt-1 text-sm text-red-600">{errors.description_en}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Examples (English) *
                    </label>
                    {formData.examples.map((example, index) => (
                      <div
                        key={index}
                        className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Example {index + 1}
                          </span>
                          {formData.examples.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeExample(index)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400"
                            >
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={example.en.input}
                          onChange={(e) => updateExample(index, 'en', 'input', e.target.value)}
                          className="mb-2 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                          placeholder="Input: Toxic comment example"
                        />
                        <textarea
                          value={example.en.output}
                          onChange={(e) => updateExample(index, 'en', 'output', e.target.value)}
                          rows={2}
                          className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                          placeholder="Output: Generated roast example"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addExample}
                      className="text-sm text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      + Add example
                    </button>
                    {errors.examples && (
                      <p className="mt-1 text-sm text-red-600">{errors.examples}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Personality, Resources, Restrictions (language-agnostic) */}
              <div className="mt-8 space-y-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Personalidad *
                  </label>
                  <textarea
                    value={formData.personality}
                    onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                    rows={3}
                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                      errors.personality
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:border-red-500 focus:ring-red-500'
                    } dark:bg-gray-700 dark:text-white`}
                    placeholder="Ej: Educado, irónico, elegante. Inspirado en..."
                  />
                  {errors.personality && (
                    <p className="mt-1 text-sm text-red-600">{errors.personality}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recursos Permitidos *
                  </label>
                  {formData.resources.map((resource, index) => (
                    <div key={index} className="flex mb-2">
                      <input
                        type="text"
                        value={resource}
                        onChange={(e) => updateResource(index, e.target.value)}
                        className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                        placeholder="Ej: Ironía marcada, Double entendre"
                      />
                      {formData.resources.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeResource(index)}
                          className="ml-2 text-red-600 hover:text-red-900 dark:text-red-400"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addResource}
                    className="text-sm text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  >
                    + Añadir recurso
                  </button>
                  {errors.resources && (
                    <p className="mt-1 text-sm text-red-600">{errors.resources}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Restricciones CRÍTICAS *
                  </label>
                  {formData.restrictions.map((restriction, index) => (
                    <div key={index} className="flex mb-2">
                      <input
                        type="text"
                        value={restriction}
                        onChange={(e) => updateRestriction(index, e.target.value)}
                        className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                        placeholder="Ej: NO insultos directos, NO vulgaridad"
                      />
                      {formData.restrictions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRestriction(index)}
                          className="ml-2 text-red-600 hover:text-red-900 dark:text-red-400"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addRestriction}
                    className="text-sm text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  >
                    + Añadir restricción
                  </button>
                  {errors.restrictions && (
                    <p className="mt-1 text-sm text-red-600">{errors.restrictions}</p>
                  )}
                </div>

                <div className="flex items-center space-x-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Activo</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Predeterminado
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                {tone ? 'Actualizar' : 'Crear'} Tono
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:w-auto sm:text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ToneEditor;
