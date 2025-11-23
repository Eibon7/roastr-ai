import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Copy, Check, Info, Shield, Settings } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useI18n } from '../hooks/useI18n';

const TransparencySettings = () => {
  const { t } = useI18n();
  const [currentMode, setCurrentMode] = useState('bio');
  const [bioText, setBioText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState('twitter');
  const [platformBioTexts, setPlatformBioTexts] = useState({});

  // Load transparency settings on component mount
  useEffect(() => {
    loadTransparencySettings();
  }, []);

  // Clear messages after delay
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const loadTransparencySettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/user/settings/transparency-mode');

      if (response.data.success) {
        const { transparency_mode, bio_text } = response.data.data;
        setCurrentMode(transparency_mode || 'bio');
        setBioText(bio_text || '');

        // Generate platform-specific variations
        if (bio_text) {
          generatePlatformBioTexts(bio_text);
        }
      }
    } catch (err) {
      console.error('Failed to load transparency settings:', err);
      setError('Error al cargar la configuración de transparencia');
    } finally {
      setLoading(false);
    }
  };

  const generatePlatformBioTexts = (baseBioText) => {
    const platforms = {
      twitter: {
        name: 'Twitter / X',
        charLimit: 160,
        text: baseBioText,
        icon: '🐦'
      },
      instagram: {
        name: 'Instagram',
        charLimit: 150,
        text: baseBioText.length > 150 ? 'Respuestas generadas con IA 🤖' : baseBioText,
        icon: '📸'
      },
      linkedin: {
        name: 'LinkedIn',
        charLimit: 120,
        text: 'Algunas respuestas generadas con tecnología de IA.',
        icon: '💼'
      },
      tiktok: {
        name: 'TikTok',
        charLimit: 80,
        text: 'AI-powered responses 🤖',
        icon: '🎵'
      },
      youtube: {
        name: 'YouTube',
        charLimit: 1000,
        text:
          baseBioText +
          ' | Algunas respuestas en comentarios son generadas con inteligencia artificial para mantener conversaciones constructivas.',
        icon: '📺'
      }
    };

    setPlatformBioTexts(platforms);
  };

  const updateTransparencyMode = async (mode) => {
    try {
      setSaving(true);
      setError(null);

      const response = await apiClient.patch('/user/settings/transparency-mode', {
        mode: mode
      });

      if (response.data.success) {
        setCurrentMode(mode);
        const newBioText = response.data.data.bio_text || '';
        setBioText(newBioText);

        // Regenerate platform-specific texts when bio mode is selected
        if (mode === 'bio' && newBioText) {
          generatePlatformBioTexts(newBioText);
        }

        setSuccess('Configuración de transparencia actualizada correctamente');
      }
    } catch (err) {
      console.error('Failed to update transparency mode:', err);
      setError('Error al actualizar la configuración de transparencia');
    } finally {
      setSaving(false);
    }
  };

  const copyBioText = async (platformKey = null) => {
    try {
      const textToCopy =
        platformKey && platformBioTexts[platformKey] ? platformBioTexts[platformKey].text : bioText;

      await navigator.clipboard.writeText(textToCopy);
      setCopied(platformKey || true);
      setTimeout(() => setCopied(false), 2000);

      const platformName =
        platformKey && platformBioTexts[platformKey] ? platformBioTexts[platformKey].name : '';

      setSuccess(`Texto copiado al portapapeles${platformName ? ' para ' + platformName : ''}`);
    } catch (err) {
      console.error('Failed to copy bio text:', err);
      setError('Error al copiar el texto');
    }
  };

  const transparencyOptions = [
    {
      value: 'bio',
      title: 'Aviso en Bio (recomendado)',
      description:
        'Añades el texto sugerido en tu bio una sola vez. Los roasts se publican sin modificaciones.',
      detailedDescription:
        'La opción más limpia y profesional. Perfecto si usas Roastr ocasionalmente o prefieres mantener tus roasts sin modificaciones.',
      pros: ['Roasts limpios sin modificaciones', 'Una sola configuración', 'Aspecto profesional'],
      cons: ['Requiere actualizar tu bio', 'Menos visible por roast individual'],
      usageExample: 'Ideal para: Uso ocasional, perfil profesional, máxima limpieza visual',
      isDefault: true,
      icon: '📝',
      difficulty: 'Fácil'
    },
    {
      value: 'signature',
      title: 'Firma clásica',
      description: 'Cada roast termina con "— Generado por Roastr.AI". Simple y directo.',
      detailedDescription:
        'Una firma consistente y reconocible en cada roast. Transparencia clara sin ser intrusiva.',
      pros: [
        'Transparencia en cada roast',
        'Consistente y reconocible',
        'No requiere cambios en bio'
      ],
      cons: ['Añade caracteres a cada roast', 'Menos creativo'],
      usageExample: 'Ideal para: Uso regular, máxima transparencia, simplicidad',
      isDefault: false,
      icon: '✍️',
      difficulty: 'Fácil'
    },
    {
      value: 'creative',
      title: 'Disclaimers creativos',
      description:
        'Cada roast termina con un disclaimer aleatorio divertido que mantiene el tono humor.',
      detailedDescription:
        'Variedad y diversión en cada roast. Los disclaimers cambian para mantener el interés y el tono divertido.',
      pros: ['Variedad en cada roast', 'Mantiene el humor', 'Más entretenido para lectores'],
      cons: ['Puede ser menos predecible', 'Más caracteres utilizados'],
      usageExample: 'Ideal para: Uso frecuente, audiencia que disfruta variedad, tono informal',
      isDefault: false,
      icon: '🎭',
      difficulty: 'Automático'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-sm text-green-800">{success}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center space-x-2">
        <Shield className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-medium text-gray-900">Transparencia de IA</h3>
      </div>

      {/* Description */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="mb-3">
              <strong>¿Por qué es importante?</strong> Por cumplimiento de las políticas de OpenAI y
              redes sociales, es recomendable identificar cuando las respuestas son generadas por
              IA. No es una obligación pesada, sino una práctica ética que mantiene la confianza con
              tu audiencia.
            </p>
            <p className="mb-2">
              <strong>🎯 Beneficios:</strong>
            </p>
            <ul className="text-xs space-y-1 ml-4 list-disc">
              <li>Cumples con las mejores prácticas de transparencia en IA</li>
              <li>Mantienes la confianza de tu audiencia</li>
              <li>Evitas posibles problemas con plataformas de redes sociales</li>
              <li>Demuestras uso responsable de herramientas de IA</li>
            </ul>
          </div>
        </div>
      </div>

      {/* How it works section */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <div className="text-yellow-600 text-lg">💡</div>
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-2">¿Cómo funciona?</p>
            <p>
              Roastr te ofrece tres formas de manejar la transparencia. Puedes cambiar entre ellas
              en cualquier momento según tus necesidades y el tipo de contenido que publiques:
            </p>
            <div className="mt-2 text-xs">
              <p>
                <strong>• Modo Bio:</strong> Ideal si publicas ocasionalmente - mencionas Roastr una
                vez en tu bio
              </p>
              <p>
                <strong>• Firma Clásica:</strong> Perfecto para uso regular - cada roast incluye una
                firma discreta
              </p>
              <p>
                <strong>• Disclaimers Creativos:</strong> Para usuarios frecuentes - añade variedad
                con mensajes divertidos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transparency Mode Options */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-900 flex items-center space-x-2">
          <Settings className="h-4 w-4" />
          <span>Opciones de transparencia</span>
        </h4>

        <div className="space-y-3">
          {transparencyOptions.map((option) => (
            <div
              key={option.value}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                currentMode === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => !saving && updateTransparencyMode(option.value)}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div
                    className={`w-4 h-4 rounded-full border-2 mt-1 ${
                      currentMode === option.value
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {currentMode === option.value && (
                      <div className="w-full h-full rounded-full bg-white scale-50"></div>
                    )}
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{option.icon}</span>
                    <h5 className="font-medium text-gray-900">
                      {option.title}
                      {option.isDefault && (
                        <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                          Por defecto
                        </span>
                      )}
                    </h5>
                    <span className="ml-auto px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      {option.difficulty}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">{option.description}</p>

                  <p className="text-xs text-gray-500 mb-3">{option.detailedDescription}</p>

                  {/* Usage example */}
                  <div className="text-xs text-blue-600 mb-2">{option.usageExample}</div>

                  {/* Pros and Cons */}
                  {currentMode === option.value && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="font-medium text-green-700 mb-1 flex items-center">
                            <span className="mr-1">✅</span> Ventajas
                          </div>
                          <ul className="space-y-1 text-green-600">
                            {option.pros.map((pro, idx) => (
                              <li key={idx}>• {pro}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="font-medium text-orange-700 mb-1 flex items-center">
                            <span className="mr-1">⚠️</span> Consideraciones
                          </div>
                          <ul className="space-y-1 text-orange-600">
                            {option.cons.map((con, idx) => (
                              <li key={idx}>• {con}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {saving && (
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Guardando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Bio Text Section - Only show when bio mode is selected */}
      {currentMode === 'bio' && bioText && (
        <div className="border border-gray-200 rounded-lg p-4 bg-yellow-50">
          <div className="text-sm font-medium mb-4 text-gray-900 flex items-center space-x-2">
            <span>📝</span>
            <span>Textos optimizados por plataforma</span>
          </div>

          {/* Platform tabs */}
          {Object.keys(platformBioTexts).length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(platformBioTexts).map(([key, platform]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPlatform(key)}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors flex items-center space-x-1 ${
                      selectedPlatform === key
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{platform.icon}</span>
                    <span>{platform.name}</span>
                    <span className="text-xs opacity-60">({platform.text.length})</span>
                  </button>
                ))}
              </div>

              {/* Selected platform bio text */}
              {platformBioTexts[selectedPlatform] && (
                <div className="bg-white border border-gray-300 rounded p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{platformBioTexts[selectedPlatform].icon}</span>
                      <span className="font-medium text-sm">
                        {platformBioTexts[selectedPlatform].name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {platformBioTexts[selectedPlatform].text.length}/
                      {platformBioTexts[selectedPlatform].charLimit} caracteres
                    </div>
                  </div>
                  <div className="text-sm font-mono text-gray-800 break-words bg-gray-50 rounded p-2">
                    {platformBioTexts[selectedPlatform].text}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <Button
                  onClick={() => copyBioText(selectedPlatform)}
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-initial"
                  disabled={!platformBioTexts[selectedPlatform]}
                >
                  {copied === selectedPlatform ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar para {platformBioTexts[selectedPlatform]?.name}
                    </>
                  )}
                </Button>

                {/* Universal copy button */}
                <Button
                  onClick={() => copyBioText()}
                  variant="ghost"
                  size="sm"
                  className="flex-1 sm:flex-initial"
                >
                  {copied === true ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar original
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-600 space-y-2">
            <div className="bg-white bg-opacity-50 rounded p-2">
              <p className="font-medium mb-2">
                📋 <strong>Instrucciones paso a paso:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Selecciona tu plataforma favorita arriba</li>
                <li>Haz clic en "Copiar para [Plataforma]"</li>
                <li>Ve a tu perfil en esa red social</li>
                <li>Edita tu biografía/bio</li>
                <li>Pega el texto copiado al final de tu bio actual</li>
                <li>Guarda los cambios</li>
              </ol>
            </div>

            <div className="bg-blue-50 bg-opacity-50 rounded p-2">
              <p className="font-medium text-blue-800">
                💡 <strong>Nuevas funcionalidades:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>
                  <strong>Optimización automática:</strong> Cada plataforma tiene un texto adaptado
                  a sus límites
                </li>
                <li>
                  <strong>Contador de caracteres:</strong> Verifica que el texto cabe en el límite
                  de cada plataforma
                </li>
                <li>
                  <strong>Multi-plataforma:</strong> Textos específicos para Twitter, Instagram,
                  LinkedIn, TikTok y YouTube
                </li>
                <li>
                  <strong>Flexibilidad total:</strong> Puedes usar el texto original o las variantes
                  optimizadas
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Transparency Signature Preview - Show for signature and creative modes */}
      {(currentMode === 'signature' || currentMode === 'creative') && (
        <div className="border border-gray-200 rounded-lg p-4 bg-green-50">
          <div className="text-sm font-medium mb-4 text-gray-900 flex items-center space-x-2">
            <span>{currentMode === 'signature' ? '✍️' : '🎭'}</span>
            <span>
              Vista previa de {currentMode === 'signature' ? 'firmas' : 'disclaimers creativos'}
            </span>
          </div>

          {currentMode === 'signature' && (
            <div className="space-y-3">
              <div className="bg-white border rounded-lg p-4">
                <div className="text-sm text-gray-800 mb-3">
                  <strong>Tu firma aparecerá así:</strong>
                </div>
                <div className="bg-gray-50 rounded p-3 text-sm font-mono text-gray-700 border-l-4 border-blue-400">
                  — Generado por Roastr.AI
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="text-xs text-blue-800">
                  <div className="font-medium mb-2">📋 Características de la firma:</div>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>
                      <strong>Consistente:</strong> Siempre la misma firma en cada roast
                    </li>
                    <li>
                      <strong>Profesional:</strong> Texto serio y directo
                    </li>
                    <li>
                      <strong>Compacta:</strong> Solo 22 caracteres, mínimo impacto
                    </li>
                    <li>
                      <strong>Reconocible:</strong> Fácil identificación de contenido IA
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {currentMode === 'creative' && (
            <div className="space-y-3">
              <div className="bg-white border rounded-lg p-4">
                <div className="text-sm text-gray-800 mb-3">
                  <strong>Ejemplos de disclaimers creativos (seleccionados aleatoriamente):</strong>
                </div>

                <div className="space-y-3">
                  {[
                    'Este roast fue generado por IA. Tranquilo: ningún humano perdió tiempo en ti.',
                    'Roast 100% artificial. Como tus posibilidades de tener razón.',
                    'Generado por inteligencia artificial. La única inteligencia presente en esta conversación.',
                    'IA vs. tu comentario: 1-0 para los robots.',
                    'Disclaimer: Esta respuesta fue creada por una máquina que entiende mejor el humor que tú.'
                  ].map((disclaimer, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 rounded p-3 border-l-4 border-purple-400"
                    >
                      <div className="text-sm font-mono text-gray-700">{disclaimer}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {disclaimer.length} caracteres
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded p-3">
                <div className="text-xs text-purple-800">
                  <div className="font-medium mb-2">
                    🎭 Características de disclaimers creativos:
                  </div>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>
                      <strong>Variedad:</strong> Más de 10 disclaimers diferentes que rotan
                      aleatoriamente
                    </li>
                    <li>
                      <strong>Humor integrado:</strong> Mantienen el tono sarcástico y divertido
                    </li>
                    <li>
                      <strong>Transparencia clara:</strong> Identifican claramente el uso de IA
                    </li>
                    <li>
                      <strong>Engagement:</strong> Los lectores pueden disfrutar la variedad
                    </li>
                    <li>
                      <strong>Adaptativo:</strong> Se selecciona automáticamente el mejor según el
                      contexto
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <div className="text-xs text-yellow-800 flex items-start space-x-2">
                  <span className="text-yellow-600">⚡</span>
                  <div>
                    <div className="font-medium mb-1">Selección inteligente</div>
                    <p>
                      El sistema selecciona automáticamente el disclaimer más apropiado basándose
                      en:
                    </p>
                    <ul className="mt-1 space-y-1 list-disc list-inside ml-2">
                      <li>Longitud del roast original</li>
                      <li>Límite de caracteres de la plataforma</li>
                      <li>Contexto del comentario original</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Examples */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3 text-gray-900 flex items-center space-x-2">
          <span>👁️</span>
          <span>Vista previa de respuestas</span>
        </h4>

        <div className="space-y-4">
          {/* Bio mode example */}
          {currentMode === 'bio' && (
            <div>
              <div className="bg-gray-50 border rounded p-3 mb-3">
                <div className="text-sm text-gray-800 mb-2">
                  "Tu comentario tiene menos creatividad que una calculadora rota."
                </div>
                <div className="text-xs text-blue-600 flex items-center space-x-1">
                  <span>📝</span>
                  <span>Roast limpio (transparencia en tu bio)</span>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <div className="text-xs text-yellow-800">
                  <strong>📄 Tu bio incluye:</strong> "
                  {bioText || 'Algunas respuestas generadas con ayuda de IA.'}"
                </div>
              </div>
            </div>
          )}

          {/* Signature mode example */}
          {currentMode === 'signature' && (
            <div className="bg-gray-50 border rounded p-3">
              <div className="text-sm text-gray-800">
                "Tu comentario tiene menos creatividad que una calculadora rota."
                <div className="mt-3 text-xs text-gray-500 border-t pt-2 italic">
                  — Generado por Roastr.AI
                </div>
              </div>
              <div className="text-xs text-green-600 mt-2 flex items-center space-x-1">
                <span>✍️</span>
                <span>Firma consistente en cada roast</span>
              </div>
            </div>
          )}

          {/* Creative mode example */}
          {currentMode === 'creative' && (
            <div className="space-y-3">
              <div className="bg-gray-50 border rounded p-3">
                <div className="text-sm text-gray-800">
                  "Tu comentario tiene menos creatividad que una calculadora rota."
                  <div className="mt-3 text-xs text-gray-500 border-t pt-2 italic">
                    Este roast fue generado por IA. Tranquilo: ningún humano perdió tiempo en ti.
                  </div>
                </div>
                <div className="text-xs text-purple-600 mt-2 flex items-center space-x-1">
                  <span>🎭</span>
                  <span>Ejemplo de disclaimer creativo #1</span>
                </div>
              </div>

              <div className="bg-gray-50 border rounded p-3">
                <div className="text-sm text-gray-800">
                  "¿En serio? Esa respuesta la daría mi abuela... y ella no usa internet."
                  <div className="mt-3 text-xs text-gray-500 border-t pt-2 italic">
                    Roast 100% artificial. Como tus posibilidades de tener razón.
                  </div>
                </div>
                <div className="text-xs text-purple-600 mt-2 flex items-center space-x-1">
                  <span>🎭</span>
                  <span>Ejemplo de disclaimer creativo #2</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-xs text-green-800">
          <div className="flex items-start space-x-2">
            <span className="text-green-600">✨</span>
            <div>
              <p className="font-medium mb-1">Los cambios se aplican inmediatamente</p>
              <p>
                Todos los roasts futuros usarán tu configuración seleccionada. Los roasts anteriores
                no se modifican.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransparencySettings;
