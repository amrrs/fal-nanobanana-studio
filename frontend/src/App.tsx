import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ImageIcon,
  Upload,
  Download,
  Sparkles,
  Loader2,
  X,
  Wand2,
  Layers,
  History,
  Settings2,
  MousePointer2,
  Crop,
  Plus,
  Eye,
  EyeOff,
  Eraser,
  SunMedium,
  Camera,
  Zap,
  Sparkles as SparklesIcon,
  Palette,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Cropper, { Area } from 'react-easy-crop';
import { Mode, ModelId } from './types';
import { editImage, generateImage, segmentImage, checkHealth } from './api';
import { validateImageFile, extractImageUrl, dataUrlToBlob, downloadImage, getTimestamp } from './utils';
import './App.css';
import 'react-easy-crop/react-easy-crop.css';

type LayerKind = 'source' | 'ai' | 'empty' | 'segment';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  preview?: string | null;
  timestamp: string;
  visible?: boolean;
  metadata?: {
    maskUrl?: string;
    boundingBox?: BoundingBox | null;
  };
}

interface QuickEditAction {
  label: string;
  description: string;
  prompt: string;
  negativePrompt?: string;
  icon: LucideIcon;
}

function App() {
  const [image, setImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('edit');
  const [apiConfigured, setApiConfigured] = useState(true);
  const [activeTool, setActiveTool] = useState('select');
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [cropTargetLayerId, setCropTargetLayerId] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [aiLayerCount, setAiLayerCount] = useState(0);
  const [adjustmentCount, setAdjustmentCount] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(3 / 2);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [model, setModel] = useState<ModelId>('nano');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const menuItems = ['Export', 'Help'];
  const toolset = [
    { id: 'select', label: 'Select', icon: MousePointer2 },
    { id: 'crop', label: 'Crop', icon: Crop },
    { id: 'filters', label: 'Filters', icon: Sparkles },
    { id: 'magic', label: 'Magic', icon: Wand2 },
  ];
  const presetPrompts = [
    {
      label: 'Portrait glow',
      prompt:
        'Hyper-real studio portrait, cinematic rim lighting, polished skin texture, subtle bokeh background, warm highlights',
    },
    {
      label: 'Cinematic matte',
      prompt:
        'Moody widescreen grade, teal and amber palette, lifted blacks, film grain, dramatic contrast, cinematic atmosphere',
    },
    {
      label: 'Product polish',
      prompt:
        'Luxury product beauty lighting, reflective podium, glossy highlights, high-contrast shadows, editorial look',
    },
    {
      label: 'Golden hour',
      prompt:
        'Sunset hues, soft volumetric light, warm peach glow, long natural shadows, coastal warmth, dreamy tone',
    },
    {
      label: 'Analog film',
      prompt:
        'Kodak portra palette, soft halation, subtle film grain, gentle fades, authentic analog imperfections',
    },
  ];

  const filterPresets = [
    {
      label: 'Vintage Film',
      prompt: 'Kodak Portra 400 film, warm amber tones, subtle grain texture, vintage color grading, authentic film imperfections, cinematic look',
      category: 'Film'
    },
    {
      label: 'Black & White',
      prompt: 'High contrast black and white, dramatic shadows, rich textures, classic photography, silver gelatin print aesthetic, moody atmosphere',
      category: 'Monochrome'
    },
    {
      label: 'Sepia Tone',
      prompt: 'Warm sepia tones, vintage photograph, antique brown coloring, historical aesthetic, aged paper texture, nostalgic atmosphere',
      category: 'Vintage'
    },
    {
      label: 'High Contrast',
      prompt: 'Extreme contrast, deep blacks, bright highlights, dramatic lighting, bold shadows, punchy colors, vibrant saturation',
      category: 'Dramatic'
    },
    {
      label: 'Soft Glow',
      prompt: 'Soft dreamy glow, ethereal lighting, gentle highlights, warm ambiance, romantic atmosphere, subtle soft focus, luminous quality',
      category: 'Dreamy'
    },
    {
      label: 'Cinematic Teal',
      prompt: 'Cinematic color grading, teal and orange palette, film look, lifted blacks, subtle grain, Hollywood cinematography style',
      category: 'Cinematic'
    },
    {
      label: 'Neon Glow',
      prompt: 'Vibrant neon colors, cyberpunk aesthetic, electric blues and pinks, glowing highlights, futuristic atmosphere, high saturation',
      category: 'Modern'
    },
    {
      label: 'Matte Flat',
      prompt: 'Flat design aesthetic, minimal shadows, clean lighting, modern photography, reduced contrast, contemporary style, flat lay',
      category: 'Minimal'
    },
    {
      label: 'Golden Hour',
      prompt: 'Golden hour lighting, warm sunset tones, long dramatic shadows, magical atmosphere, romantic golden glow, evening light',
      category: 'Lighting'
    },
    {
      label: 'Vintage Polaroid',
      prompt: 'Polaroid instant film, faded colors, white border, authentic polaroid aesthetic, nostalgic snapshot, retro photography',
      category: 'Instant'
    },
    {
      label: 'Studio Lighting',
      prompt: 'Professional studio lighting, clean white background, even illumination, commercial photography, product photography style',
      category: 'Studio'
    },
    {
      label: 'Moody Noir',
      prompt: 'Film noir style, high contrast, deep shadows, dramatic lighting, black and white with blue tint, mysterious atmosphere',
      category: 'Noir'
    }
  ];
  const quickEdits: QuickEditAction[] = [
    {
      label: 'Clean Background',
      description: 'Isolate your subject on a soft studio gradient.',
      prompt:
        'Isolate the main subject, remove distractions, replace background with a soft neutral gradient backdrop, keep natural shadows, commercial studio polish',
      negativePrompt: 'busy background, clutter, extra hands, text, watermark',
      icon: Eraser,
    },
    {
      label: 'Product Pop',
      description: 'Boost contrast, reflections, and clarity.',
      prompt:
        'Create a premium e-commerce hero shot, punchy contrast, sharpened edges, controlled reflections, glossy highlights, gradient sweep backdrop',
      negativePrompt: 'noise, watermark, text overlay, harsh artifacts',
      icon: Camera,
    },
    {
      label: 'Portrait Glow',
      description: 'Retouch skin, add warm rim lighting.',
      prompt:
        'Subtle portrait retouch, even skin tone, soften blemishes, add warm golden rim light, cinematic bokeh background, high-end magazine aesthetic',
      negativePrompt: 'over-smoothing, plastic skin, distortion, vignette',
      icon: SunMedium,
    },
    {
      label: 'Cinematic Mood',
      description: 'Teal & amber film-grade look.',
      prompt:
        'Apply dramatic teal and amber cinematic grade, lifted blacks, gentle bloom, volumetric atmosphere, film grain, widescreen energy',
      negativePrompt: 'washed out, oversaturated, text overlay',
      icon: Palette,
    },
    {
      label: 'Vibrant Neon',
      description: 'Add cyberpunk neon accents.',
      prompt:
        'Introduce neon magenta and cyan rim lighting, subtle glow trails, futuristic highlights, reflective surfaces, cyberpunk energy',
      negativePrompt: 'overexposed, posterization, text badge',
      icon: Zap,
    },
    {
      label: 'Matte Vintage',
      description: 'Soft matte finish with retro tones.',
      prompt:
        'Apply vintage matte film look, muted shadows, gentle halation, warm highlights, dusted texture, analog imperfections',
      negativePrompt: 'heavy grain, scratches, frame border, text',
      icon: SparklesIcon,
    },
  ];
  const modelOptions: Array<{ id: ModelId; label: string; description: string }> = [
    {
      id: 'nano',
      label: 'Nano Banana',
      description: 'Fast & lightweight',
    },
    {
      id: 'pro',
      label: 'Nano Banana Pro',
      description: 'SOTA fidelity',
    },
  ];
  const aspectPresets = [
    { label: 'Free', ratio: undefined },
    { label: '1:1', ratio: 1 },
    { label: '4:5', ratio: 4 / 5 },
    { label: '3:2', ratio: 3 / 2 },
    { label: '16:9', ratio: 16 / 9 },
  ];

const registerLayer = useCallback(
  (
    layerData: Omit<Layer, 'id' | 'timestamp'>,
    options?: { replaceKind?: LayerKind; autoSelect?: boolean },
  ) => {
      const layer: Layer = {
        id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        ...layerData,
      visible: layerData.visible ?? true,
      };

    setLayers((prev) => {
        let base = prev;
        if (options?.replaceKind) {
          base = prev.filter((entry) => entry.kind !== options.replaceKind);
        }
        return [layer, ...base];
      });

    if (options?.autoSelect !== false) {
      setSelectedLayerId(layer.id);
    }
      return layer;
    },
    [],
  );

  const loadImageElement = useCallback((src: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        console.log(`[IMAGE LOAD] Loaded image, src start: ${src.substring(0, 60)}..., size: ${img.width}x${img.height}`);
        resolve(img);
      };
      img.onerror = (e) => {
        console.error(`[IMAGE LOAD] Failed to load image, src start: ${src.substring(0, 60)}...`, e);
        reject(e);
      };
      img.src = src;
    });
  }, []);

  const createMaskedPreview = useCallback((baseImage: HTMLImageElement, maskImage: HTMLImageElement) => {
    const width = baseImage.width;
    const height = baseImage.height;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Unable to create canvas context for segmentation preview');
    }

    canvas.width = width;
    canvas.height = height;
    
    // Clear canvas to transparent
    ctx.clearRect(0, 0, width, height);
    
    // First, check what the mask looks like
    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskCanvas.width = maskImage.width;
      maskCanvas.height = maskImage.height;
      maskCtx.drawImage(maskImage, 0, 0);
      const maskData = maskCtx.getImageData(0, 0, Math.min(100, maskImage.width), Math.min(100, maskImage.height));
      let whitePixels = 0;
      let blackPixels = 0;
      let transparentPixels = 0;
      let opaquePixels = 0;
      for (let i = 0; i < maskData.data.length; i += 4) {
        const r = maskData.data[i];
        const g = maskData.data[i + 1];
        const b = maskData.data[i + 2];
        const a = maskData.data[i + 3];
        if (a > 250) opaquePixels++;
        if (a < 10) transparentPixels++;
        else if (r > 200 && g > 200 && b > 200) whitePixels++;
        else if (r < 55 && g < 55 && b < 55) blackPixels++;
      }
      // Debug mask content (uncomment if needed)
      // console.log('[MASK] Mask analysis:', { 
      //   whitePixels, 
      //   blackPixels, 
      //   transparentPixels, 
      //   opaquePixels,
      //   totalSampled: maskData.data.length / 4,
      //   percentWhite: (whitePixels / (maskData.data.length / 4) * 100).toFixed(1) + '%',
      //   percentOpaque: (opaquePixels / (maskData.data.length / 4) * 100).toFixed(1) + '%'
      // });
    }
    
    // Draw the base image
    ctx.drawImage(baseImage, 0, 0, width, height);
    
    // Create a temporary canvas for the mask to analyze it
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      throw new Error('Unable to create temporary canvas context');
    }
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.drawImage(maskImage, 0, 0, width, height);
    const maskData = tempCtx.getImageData(0, 0, width, height);
    
    // Get the base image data
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // Apply mask: Check both alpha channel and RGB values
    // SAM2 masks can be: 1) Alpha channel mask, 2) RGB grayscale, or 3) Inverted
    let hasAlphaVariation = false;
    let hasRGBVariation = false;
    
    // Sample to detect mask type
    for (let i = 0; i < Math.min(1000, maskData.data.length); i += 4) {
      if (maskData.data[i + 3] < 255) hasAlphaVariation = true;
      if (maskData.data[i] !== maskData.data[i + 3]) hasRGBVariation = true;
    }
    
    console.log('[MASK] Detected mask type:', { hasAlphaVariation, hasRGBVariation });
    
    // Apply the mask and count non-transparent pixels
    let opaquePixelCount = 0;
    let semiTransparentCount = 0;
    let transparentCount = 0;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (hasAlphaVariation) {
        // Use alpha channel directly
        imageData.data[i + 3] = maskData.data[i + 3];
      } else {
        // Use RGB value as alpha (standard: white = keep, black = remove)
        const maskValue = maskData.data[i]; // Red channel
        imageData.data[i + 3] = maskValue; // White (255) = opaque, Black (0) = transparent
      }
      
      const alpha = imageData.data[i + 3];
      if (alpha > 200) opaquePixelCount++;
      else if (alpha > 50) semiTransparentCount++;
      else transparentCount++;
    }
    
    const totalPixels = imageData.data.length / 4;
    console.log('[MASK] Final pixel counts:', {
      opaque: opaquePixelCount,
      semiTransparent: semiTransparentCount,
      transparent: transparentCount,
      total: totalPixels,
      percentOpaque: ((opaquePixelCount / totalPixels) * 100).toFixed(1) + '%'
    });
    
    ctx.putImageData(imageData, 0, 0);

    const result = canvas.toDataURL('image/png');
    
    // Debug: Check if the result is different from the original (uncomment if needed)
    // console.log('[MASK] Created preview', {
    //   baseSize: `${baseImage.width}x${baseImage.height}`,
    //   maskSize: `${maskImage.width}x${maskImage.height}`,
    //   canvasSize: `${canvas.width}x${canvas.height}`,
    //   resultLength: result.length
    // });

    return result;
  }, []);

  const extractBoundingBox = useCallback((maskImage: HTMLImageElement): BoundingBox | null => {
    const width = maskImage.width;
    const height = maskImage.height;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(maskImage, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasPixel = false;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 25) {
          hasPixel = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixel) {
      return null;
    }

    return {
      x: (minX / width) * 100,
      y: (minY / height) * 100,
      width: ((maxX - minX + 1) / width) * 100,
      height: ((maxY - minY + 1) / height) * 100,
    };
  }, []);

  const createSegmentLayers = useCallback(
    async (
      baseImageUrl: string,
      items: Array<{ url?: string; data_url?: string }> = [],
      isSegmentedImages: boolean = false,
      masks: Array<{ url?: string; data_url?: string }> = []
    ) => {
      if (!baseImageUrl) return;

      if (!items.length) {
        setLayers((prev) => prev.filter((layer) => layer.kind !== 'segment'));
        return;
      }

      // First, clear existing segment layers
      setLayers((prev) => prev.filter((layer) => layer.kind !== 'segment'));

      // Create or update the Background/Source layer
      registerLayer(
        {
          name: 'Background',
          kind: 'source',
          preview: baseImageUrl,
          visible: true,
          metadata: {},
        },
        {
          replaceKind: 'source',
          autoSelect: false,
        },
      );

      // Collect all segment layers first, then add them in one batch
      const newSegmentLayers: Layer[] = [];
      
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const itemSource = item?.data_url || item?.url;
        
        // Try to find corresponding mask
        const maskItem = masks[i];
        const maskSource = maskItem?.data_url || maskItem?.url || (isSegmentedImages ? undefined : itemSource);
        
        console.log(`[SEGMENT ${i + 1}] Item:`, {
          hasDataUrl: !!item?.data_url,
          hasUrl: !!item?.url,
          hasMask: !!maskSource,
          dataUrlStart: item?.data_url?.substring(0, 80),
          urlStart: item?.url?.substring(0, 80)
        });
        if (!itemSource) {
          console.warn(`[SEGMENT ${i + 1}] No source found, skipping`);
          continue;
        }
        
        try {
          // If we have segmented_images, they're already the extracted objects
          // If we have individual_masks, we need to apply them to the base image
          let preview: string;
          let boundingBox: BoundingBox | null = null;
          
          if (isSegmentedImages) {
            // Already segmented - just use it directly
            preview = itemSource;
            const segmentedImage = await loadImageElement(itemSource);
            boundingBox = extractBoundingBox(segmentedImage);
          } else {
            // It's a mask - apply it to the base image
            console.log(`[SEGMENT ${i + 1}] Loading base and mask images...`);
            const baseImage = await loadImageElement(baseImageUrl);
            const maskImage = await loadImageElement(itemSource);
            console.log(`[SEGMENT ${i + 1}] Loaded base: ${baseImage.width}x${baseImage.height}, mask: ${maskImage.width}x${maskImage.height}`);
            console.log(`[SEGMENT ${i + 1}] Mask src hash:`, itemSource.substring(0, 100));
            
            // TEMP DEBUG: For the first and second segments, log details
            if (i === 0 || i === 1) {
              console.log(`[DEBUG] Segment ${i + 1} mask URL:`, itemSource.substring(0, 150));
            }
            preview = createMaskedPreview(baseImage, maskImage);
            console.log(`[SEGMENT ${i + 1}] Preview created, length: ${preview.length}, start: ${preview.substring(0, 100)}`);
            boundingBox = extractBoundingBox(maskImage);
            console.log(`[SEGMENT ${i + 1}] Created preview, boundingBox:`, boundingBox);
          }
          
          const layer: Layer = {
            id: `segment-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            name: `Segment ${i + 1}`,
            kind: 'segment',
            preview,
            visible: true,
            timestamp: new Date().toLocaleTimeString(),
            metadata: {
              maskUrl: maskSource,
              boundingBox,
            },
          };
          
          newSegmentLayers.push(layer);
          console.log(`[SEGMENT ${i + 1}] Layer created with preview length: ${preview.length}`);
        } catch (segmentError) {
          console.error(`Failed to create segment layer ${i + 1}`, segmentError);
        }
      }

      // Add all segment layers at once
      if (newSegmentLayers.length > 0) {
        setLayers((prev) => [...newSegmentLayers, ...prev]);
        setSelectedLayerId(newSegmentLayers[0].id);
        console.log(`[SEGMENTS] Added ${newSegmentLayers.length} segment layers in one batch`);
      } else {
        console.warn('[SEGMENTS] No segment layers were created');
      }
    },
    [createMaskedPreview, extractBoundingBox, loadImageElement, registerLayer],
  );

  const handleAddAdjustmentLayer = useCallback(() => {
    registerLayer({
      name: `Adjustment ${adjustmentCount}`,
      kind: 'empty',
      preview: null,
    });
    setAdjustmentCount((count) => count + 1);
  }, [adjustmentCount, registerLayer]);

  useEffect(() => {
    if (!layers.length) {
      setSelectedLayerId(null);
      return;
    }
    const exists = layers.some((layer) => layer.id === selectedLayerId);
    if (!exists) {
      setSelectedLayerId(layers[0].id);
    }
  }, [layers, selectedLayerId]);

  const activeLayer = selectedLayerId
    ? layers.find((layer) => layer.id === selectedLayerId) ?? layers[0]
    : layers[0];
  const displayedImage = activeLayer?.preview || editedImage || image;
  const canCrop = Boolean(displayedImage);
  const segmentLayers = layers.filter((layer) => layer.kind === 'segment');
  const baseImageForSegments = editedImage || image || null;
  const sourceLayer = layers.find((layer) => layer.kind === 'source');
  const showBaseImage = segmentLayers.length === 0 || !sourceLayer || sourceLayer.visible !== false;
  const historyEntries = [
    'Session started',
    image ? 'Image imported' : null,
    editedImage ? 'AI edit applied' : null,
  ].filter((entry): entry is string => Boolean(entry));

  const baseLayer = useMemo(() => {
    return layers.find((layer) => layer.kind === 'ai') || layers.find((layer) => layer.kind === 'source') || null;
  }, [layers]);

  const cropTargetLayer = useMemo(() => {
    if (cropTargetLayerId) {
      return layers.find((layer) => layer.id === cropTargetLayerId) || null;
    }
    if (activeLayer?.kind === 'segment') {
      return baseLayer;
    }
    return activeLayer ?? baseLayer;
  }, [activeLayer, baseLayer, cropTargetLayerId, layers]);

  const cropperImage = cropTargetLayer?.preview || baseImageForSegments || displayedImage || null;
  const hasEditableImage = Boolean(image || editedImage);

  const handleAutoSegment = useCallback(async () => {
    const baseImageSource = image || editedImage;
    if (!baseImageSource) return;

    setIsSegmenting(true);
    setError(null);

    try {
      const blob = await dataUrlToBlob(baseImageSource);
      const segmentationData = await segmentImage(blob);
      
      // Debug: Log what we received
      console.log('[SEGMENT] Received data:', {
        hasIndividualMasks: !!segmentationData?.individual_masks,
        individualMasksCount: segmentationData?.individual_masks?.length,
        hasSegmentedImages: !!segmentationData?.segmented_images,
        segmentedImagesCount: segmentationData?.segmented_images?.length,
        keys: Object.keys(segmentationData || {})
      });
      
      // Check if we should use segmented_images (pre-extracted objects) or individual_masks (need to apply to base)
      const hasSegmentedImages = segmentationData?.segmented_images && segmentationData.segmented_images.length > 0;
      const itemsToUse = hasSegmentedImages 
        ? segmentationData.segmented_images 
        : (segmentationData?.individual_masks || []);
      const masksToUse = segmentationData?.individual_masks || [];
      
      console.log('[SEGMENT] Using:', hasSegmentedImages ? 'segmented_images' : 'individual_masks', itemsToUse.length);
      
      await createSegmentLayers(baseImageSource, itemsToUse, hasSegmentedImages, masksToUse);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Segmentation failed';
      setError(errorMessage);
      console.error('Segmentation error:', err);
    } finally {
      setIsSegmenting(false);
    }
  }, [createSegmentLayers, dataUrlToBlob, image, editedImage]);

  const handleToolSelect = useCallback(
    (toolId: string) => {
      setActiveTool(toolId);
      if (toolId === 'crop' && canCrop) {
        const targetLayer =
          activeLayer && activeLayer.kind !== 'segment' ? activeLayer : baseLayer;
        if (targetLayer) {
          if (selectedLayerId !== targetLayer.id) {
            setSelectedLayerId(targetLayer.id);
          }
          setCropTargetLayerId(targetLayer.id);
        } else {
          setCropTargetLayerId(null);
        }
        setShowCropper(true);
      } else {
        setShowCropper(false);
        setCropTargetLayerId(null);
      }
      if (toolId === 'magic' && image) {
        handleAutoSegment();
      }
    },
    [activeLayer, baseLayer, canCrop, handleAutoSegment, image, selectedLayerId],
  );


  useEffect(() => {
    if (activeTool === 'crop' && canCrop) {
      setShowCropper(true);
    } else {
      setShowCropper(false);
    }
  }, [activeTool, canCrop]);

  useEffect(() => {
    if (showCropper) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } else {
      setCroppedAreaPixels(null);
      setCropTargetLayerId(null);
    }
  }, [showCropper]);

  const onCropComplete = useCallback((_: Area, croppedArea: Area) => {
    setCroppedAreaPixels(croppedArea);
  }, []);

  const getCroppedImage = useCallback(
    (imageSrc: string, croppedArea: Area) =>
      new Promise<string>((resolve, reject) => {
        const imageElement = new Image();
        imageElement.src = imageSrc;
        imageElement.crossOrigin = 'anonymous';
        imageElement.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = croppedArea.width;
          canvas.height = croppedArea.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }
          ctx.drawImage(
            imageElement,
            croppedArea.x,
            croppedArea.y,
            croppedArea.width,
            croppedArea.height,
            0,
            0,
            croppedArea.width,
            croppedArea.height,
          );
          resolve(canvas.toDataURL('image/png'));
        };
        imageElement.onerror = () => reject(new Error('Failed to load image for cropping'));
      }),
    [],
  );

  const handleApplyCrop = useCallback(async () => {
    if (!croppedAreaPixels) return;

    const targetLayer = cropTargetLayer || baseLayer;
    const targetImage = targetLayer?.preview || baseImageForSegments || displayedImage || editedImage || image;

    if (!targetImage) return;

    try {
      const croppedDataUrl = await getCroppedImage(targetImage, croppedAreaPixels);
      const targetKind: LayerKind = targetLayer?.kind ?? (editedImage ? 'ai' : 'source');
      const shouldResetSegments = targetKind === 'source' || targetKind === 'ai';

      setLayers((prev) => {
        let updated = targetLayer
          ? prev.map((layer) =>
              layer.id === targetLayer.id
                ? { ...layer, preview: croppedDataUrl, timestamp: new Date().toLocaleTimeString() }
                : layer,
            )
          : prev;

        if (shouldResetSegments) {
          updated = updated.filter((layer) => layer.kind !== 'segment');
        }

        return updated;
      });

      if (targetKind === 'source') {
        setImage(croppedDataUrl);
      } else if (targetKind === 'ai') {
        setEditedImage(croppedDataUrl);
      } else if (!targetLayer) {
        if (editedImage) {
          setEditedImage(croppedDataUrl);
        } else {
          setImage(croppedDataUrl);
        }
      }

      if (targetLayer) {
        setSelectedLayerId(targetLayer.id);
      }

      setShowCropper(false);
      setActiveTool('select');
      setCropTargetLayerId(null);
    } catch (cropError) {
      console.error(cropError);
      setError('Failed to crop image. Please try again.');
    }
  }, [
    baseImageForSegments,
    baseLayer,
    cropTargetLayer,
    croppedAreaPixels,
    displayedImage,
    editedImage,
    getCroppedImage,
    image,
  ]);

  const handleCancelCrop = () => {
    setShowCropper(false);
    setActiveTool('select');
    setCropTargetLayerId(null);
  };

  const handleLayerSelect = (layerId: string) => {
    setSelectedLayerId(layerId);
    
    // TEMP: Log which layer was selected for debugging
    const layer = layers.find(l => l.id === layerId);
    console.log('[LAYER SELECT]', layer?.name, 'preview length:', layer?.preview?.length);
    if (layer?.preview) {
      console.log('[LAYER SELECT] Preview URL (open in new tab):', layer.preview);
    }
  };

  const toggleLayerVisibility = useCallback((layerId: string, soloMode: boolean = false) => {
    setLayers((prev) => {
      if (soloMode) {
        // Solo mode: hide all segments except this one
        return prev.map((layer) => {
          if (layer.kind === 'segment') {
            return { ...layer, visible: layer.id === layerId };
          }
          return layer;
        });
      } else {
        // Normal toggle
        return prev.map((layer) =>
          layer.id === layerId ? { ...layer, visible: layer.visible === false ? true : false } : layer,
        );
      }
    });
  }, []);

  const handlePresetApply = (preset: string) => {
    setPrompt(preset);
  };

  const handleAspectPreset = (ratio: number | undefined) => {
    setAspect(ratio);
  };

  const handleApplyFilter = async (filterPrompt: string) => {
    if (!image) {
      setError('Please upload an image first');
      return;
    }

    if (!apiConfigured) {
      setError('API key not configured. Please check backend configuration.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPrompt(filterPrompt);

    try {
      const data = await editImage({
        image: await dataUrlToBlob(image),
        prompt: filterPrompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        model,
      });

      const imageUrl = extractImageUrl(data);
      if (imageUrl) {
        setEditedImage(imageUrl);
        registerLayer({
          name: `Filter: ${filterPrompt.trim().substring(0, 15)}...`,
          kind: 'ai',
          preview: imageUrl,
        });
        setAiLayerCount((c) => c + 1);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Filter application failed';
      setError(errorMessage);
      console.error('Filter error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickEdit = async (action: QuickEditAction) => {
    const baseSource = editedImage || image;
    if (!baseSource) {
      setError('Please upload an image first');
      return;
    }

    if (!apiConfigured) {
      setError('API key not configured. Please check backend configuration.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPrompt(action.prompt);

    try {
      const blob = await dataUrlToBlob(baseSource);
      const data = await editImage({
        image: blob,
        prompt: action.prompt.trim(),
        negativePrompt: action.negativePrompt?.trim() || undefined,
        model,
      });

      const imageUrl = extractImageUrl(data);
      if (imageUrl) {
        setEditedImage(imageUrl);
        registerLayer({
          name: `Quick: ${action.label}`,
          kind: 'ai',
          preview: imageUrl,
        });
        setAiLayerCount((count) => count + 1);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Quick edit failed';
      setError(errorMessage);
      console.error('Quick edit error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMenuClick = (menuItem: string) => {
    switch (menuItem) {
      case 'Export':
        handleDownload();
        break;
      case 'Help':
        window.open('https://github.com/your-repo/nanobanana-studio', '_blank');
        break;
      default:
        break;
    }
  };

  // Check API health on mount
  useEffect(() => {
    checkHealth()
      .then((health) => {
        setApiConfigured(health.apiConfigured);
        if (!health.apiConfigured) {
          setError('API key not configured. Please set FAL_API_KEY in backend/.env');
        }
      })
      .catch(() => {
        setError('Unable to connect to backend server');
      });
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Read file
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImage(dataUrl);
      setEditedImage(null);
      setError(null);
      registerLayer(
        {
          name: 'Source Asset',
          kind: 'source',
          preview: dataUrl,
        },
        { replaceKind: 'source' },
      );
      setAiLayerCount(0);
    };
    reader.onerror = () => {
      setError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleProcess = async () => {
    // Validate inputs
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    if (prompt.length > 2000) {
      setError('Prompt is too long (max 2000 characters)');
      return;
    }

    if (mode === 'edit' && !image) {
      setError('Please upload an image first');
      return;
    }

    if (!apiConfigured) {
      setError('API key not configured. Please check backend configuration.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let data;

      if (mode === 'edit') {
        // Convert data URL to blob
        const blob = await dataUrlToBlob(image!);

        // Call edit API
        data = await editImage({
          image: blob,
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          model,
        });
      } else {
        // Call generate API
        data = await generateImage({
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          model,
        });
      }

      // Extract image URL from response
      const imageUrl = extractImageUrl(data);

      if (imageUrl) {
        setEditedImage(imageUrl);
        const layerName = mode === 'edit' ? `AI Output ${aiLayerCount + 1}` : `Generation ${aiLayerCount + 1}`;
        registerLayer({
          name: layerName,
          kind: 'ai',
          preview: imageUrl,
        });
        setAiLayerCount((count) => count + 1);
      } else {
        throw new Error('No image in response. Please try again.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error processing image:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (editedImage) {
      const filename = `nanobanana-${mode}-${getTimestamp()}.png`;
      downloadImage(editedImage, filename);
    }
  };

  const handleClearImage = () => {
    setImage(null);
    setEditedImage(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleProcess();
    }
  };

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand">
          <Sparkles className="brand-icon" size={20} />
          <div>
            <p className="brand-title">NanoBanana Studio</p>
            <span className="brand-subtitle">NanoBanana & Pro • fal.ai</span>
          </div>
        </div>

        <div className="quick-action-nav">
          {quickEdits.map((action) => (
            <button
              key={action.label}
              type="button"
              className="quick-action-icon-btn"
              onClick={() => handleQuickEdit(action)}
              disabled={!hasEditableImage || isLoading}
              title={action.description}
            >
              <action.icon size={16} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        <nav className="menu-strip">
          {menuItems.map((label) => (
            <button
              key={label}
              className="menu-item"
              type="button"
              onClick={() => handleMenuClick(label)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="status-cluster">
          <span className={`status-dot ${apiConfigured ? 'online' : 'offline'}`} />
          <span>{apiConfigured ? 'Connected' : 'API Offline'}</span>
          <button className="secondary-btn" type="button">
            <Settings2 size={16} />
            Studio prefs
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="tool-panel">
          {toolset.map((tool) => (
            <button
              key={tool.id}
              className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => handleToolSelect(tool.id)}
              disabled={tool.id === 'crop' && !canCrop}
              type="button"
            >
              <tool.icon size={18} />
              <span>{tool.label}</span>
            </button>
          ))}
        </aside>

        <section className="canvas-shell">
          <div className="options-bar">
            <div>
              <p className="document-title">
                {image ? 'canvas.png' : 'Untitled canvas'}
              </p>
              <span className="document-subtitle">
                {mode === 'edit' ? 'Layered Edit Session' : 'Generative Session'}
              </span>
            </div>
            <div className="mode-toggle chips">
              <button
                className={`mode-chip ${mode === 'edit' ? 'active' : ''}`}
                onClick={() => handleModeChange('edit')}
                disabled={isLoading}
                type="button"
              >
                <ImageIcon size={16} />
                Edit
              </button>
              <button
                className={`mode-chip ${mode === 'generate' ? 'active' : ''}`}
                onClick={() => handleModeChange('generate')}
                disabled={isLoading}
                type="button"
              >
                <Wand2 size={16} />
                Generate
              </button>
            </div>
            <div className="model-toggle chips">
              {modelOptions.map((option) => (
                <button
                  key={option.id}
                  className={`model-chip ${model === option.id ? 'active' : ''}`}
                  onClick={() => setModel(option.id)}
                  type="button"
                  disabled={isLoading}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="canvas-stage">
            <div className="canvas-area pro">
              {!displayedImage ? (
                mode === 'edit' ? (
                  <div className="empty-state">
                    <ImageIcon size={64} />
                    <p>Edit Images with AI</p>
                    <span className="hint">Supports JPEG, PNG, and WebP (max 50MB)</span>
                  </div>
                ) : (
                  <div className="empty-state">
                    <Wand2 size={64} />
                    <p>Describe the scene you need</p>
                    <span className="hint">Press Ctrl/Cmd + Enter to generate</span>
                  </div>
                )
              ) : (
                <div className={`image-container framed ${showCropper ? 'cropping' : ''}`}>
                  {showCropper && cropperImage ? (
                    <div className="cropper-wrapper">
                      <Cropper
                        image={cropperImage}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                      />
                    </div>
                  ) : (
                    <div className="canvas-stack">
                      {baseImageForSegments && (
                        <img
                          src={baseImageForSegments}
                          alt="Canvas preview"
                          className="result-image"
                          style={{
                            visibility: showBaseImage ? 'visible' : 'hidden',
                          }}
                        />
                      )}
                      {segmentLayers.length > 0 && (
                        <div className="segmentation-overlay">
                          {(() => {
                            const visibleCount = segmentLayers.filter(l => l.visible !== false).length;
                            console.log(`[RENDER] Rendering ${visibleCount} visible segments out of ${segmentLayers.length} total`);
                            return null;
                          })()}
                          {segmentLayers.map((layer, idx) => {
                            if (!layer.preview) {
                              console.warn(`[RENDER] Layer ${layer.name} has no preview`);
                              return null;
                            }
                            const isVisible = layer.visible !== false;
                            const isSelected = layer.id === activeLayer?.id;
                            
                            // Debug first layer
                            if (idx === 0) {
                              console.log(`[RENDER] First segment layer:`, {
                                name: layer.name,
                                isVisible,
                                isSelected,
                                previewLength: layer.preview.length,
                                previewStart: layer.preview.substring(0, 50)
                              });
                            }
                            
                            return (
                              <div
                                key={layer.id}
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  display: isVisible ? 'flex' : 'none',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  opacity: !isVisible ? 0 : (isSelected ? 1 : 0.8),
                                  pointerEvents: isVisible ? 'auto' : 'none',
                                }}
                                onClick={() => isVisible && handleLayerSelect(layer.id)}
                              >
                                <img
                                  src={layer.preview}
                                  alt={layer.name}
                                  className={`segment-mask ${isSelected ? 'selected' : ''}`}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                  }}
                                  onLoad={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    console.log(`[RENDER] ${layer.name} loaded: ${img.naturalWidth}x${img.naturalHeight}, displayed: ${img.width}x${img.height}`);
                                  }}
                                  onError={(e) => console.error(`[RENDER] Image failed to load: ${layer.name}`, e)}
                                />
                              </div>
                            );
                          })}
                          {activeLayer?.kind === 'segment' && activeLayer.metadata?.boundingBox && (
                            <div
                              className="selection-box"
                              style={{
                                left: `${activeLayer.metadata.boundingBox.x}%`,
                                top: `${activeLayer.metadata.boundingBox.y}%`,
                                width: `${activeLayer.metadata.boundingBox.width}%`,
                                height: `${activeLayer.metadata.boundingBox.height}%`,
                              }}
                            />
                          )}
                        </div>
                      )}
                      {isSegmenting && (
                        <div className="segmentation-loading">
                          <Loader2 className="spinner" size={40} />
                          <span>Segmenting objects...</span>
                        </div>
                      )}
                      {editedImage && (
                        <div className="image-actions floating">
                          <button onClick={handleDownload} className="download-btn" type="button">
                            <Download size={18} />
                            Export PNG
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="stack-panels">
              <div className="panel-card subtle">
                <div className="panel-header">
                  <div className="panel-header-info">
                    <Layers size={16} />
                    <span>Layers</span>
                  </div>
                  <button className="layer-add-btn" type="button" onClick={handleAddAdjustmentLayer}>
                    <Plus size={14} />
                    New layer
                  </button>
                </div>
                <div className="layer-list">
                  {layers.length === 0 ? (
                    <div className="layer-item muted">Layers will appear here</div>
                  ) : (
                    layers.map((layer) => (
                      <button
                        key={layer.id}
                        type="button"
                        onClick={() => handleLayerSelect(layer.id)}
                        className={`layer-item ${
                          layer.id === activeLayer?.id ? 'active' : ''
                        } ${!layer.preview ? 'muted' : ''} ${layer.visible === false ? 'hidden' : ''}`}
                      >
                        <div className="layer-meta">
                          <strong>{layer.name}</strong>
                          <span>{layer.timestamp}</span>
                        </div>
                        <div className="layer-actions">
                          <span className={`layer-pill ${layer.kind}`}>{layer.kind}</span>
                          {layer.kind === 'segment' && layer.preview && (
                            <>
                              <button
                                type="button"
                                className="layer-eye-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  // Download this segment
                                  if (layer.preview) {
                                    const link = document.createElement('a');
                                    link.href = layer.preview;
                                    link.download = `${layer.name}.png`;
                                    link.click();
                                  }
                                }}
                                aria-label="Download segment"
                                title="Download segment"
                              >
                                <Download size={14} />
                              </button>
                              <button
                                type="button"
                                className="layer-eye-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleLayerVisibility(layer.id, event.altKey);
                                }}
                                aria-label={layer.visible === false ? 'Show layer' : 'Hide layer'}
                                title={layer.visible === false ? 'Show layer (Alt+Click to solo)' : 'Hide layer (Alt+Click to solo)'}
                              >
                                {layer.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </>
                          )}
                          {layer.kind === 'source' && (
                            <button
                              type="button"
                              className="layer-eye-btn"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleLayerVisibility(layer.id);
                              }}
                              aria-label={layer.visible === false ? 'Show background' : 'Hide background'}
                            >
                              {layer.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="panel-card subtle">
                <div className="panel-header">
                  <History size={16} />
                  <span>History</span>
                </div>
                <ul className="history-list">
                  {historyEntries.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <aside className="control-panel">
          <div className="panel-card">
            <div className="panel-header">
              <h2>{mode === 'edit' ? 'Edit Controls' : 'Generation Controls'}</h2>
            </div>

            {mode === 'edit' && (
              <div className="upload-deck">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  onChange={handleImageUpload}
                  className="file-input"
                  id="file-input"
                  disabled={isLoading}
                />
                <label htmlFor="file-input" className={`upload-btn ${isLoading ? 'disabled' : ''}`}>
                  <Upload size={20} />
                  {image ? 'Replace Asset' : 'Import Image'}
                </label>
                {image && (
                  <button
                    className="clear-btn ghost"
                    onClick={handleClearImage}
                    disabled={isLoading}
                    type="button"
                  >
                    <X size={16} />
                    Remove Layer
                  </button>
                )}
              </div>
            )}

            <div className="prompt-section">
              <div className="prompt-header">
                <label htmlFor="prompt">
                  {mode === 'edit' ? 'Editing prompt' : 'Generation prompt'}
                </label>
                <span className="char-count">{prompt.length}/2000</span>
              </div>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                  mode === 'edit'
                    ? 'Relight the subject with golden hour tones...'
                    : 'Ultra-wide hero shot of a desert city at dusk...'
                }
                rows={5}
                className="prompt-input"
                disabled={isLoading}
                maxLength={2000}
              />
            </div>

            <div className="prompt-section">
              <label htmlFor="negative-prompt">Negative prompt</label>
              <textarea
                id="negative-prompt"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Artifacts to avoid (e.g., blur, watermark, distortion)"
                rows={3}
                className="prompt-input"
                disabled={isLoading}
              />
            </div>

            {activeTool === 'crop' && canCrop && (
              <div className="crop-controls">
                <div className="crop-header">
                  <div>
                    <p>Crop controls</p>
                    <span>Use handles directly on canvas</span>
                  </div>
                </div>
                <div className="aspect-options">
                  {aspectPresets.map((preset) => {
                    const isActive = preset.ratio ? aspect === preset.ratio : !aspect;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={`aspect-chip ${isActive ? 'active' : ''}`}
                        onClick={() => handleAspectPreset(preset.ratio)}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <label className="crop-label" htmlFor="crop-zoom">
                  Zoom
                </label>
                <input
                  id="crop-zoom"
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="crop-slider"
                />
                <div className="crop-actions">
                  <button className="clear-btn ghost" type="button" onClick={handleCancelCrop}>
                    Cancel
                  </button>
                  <button
                    className="primary-btn"
                    type="button"
                    onClick={handleApplyCrop}
                    disabled={!croppedAreaPixels}
                  >
                    Apply crop
                  </button>
                </div>
              </div>
            )}

            {activeTool === 'filters' && (
              <div className="filters-panel">
                <div className="panel-header">
                  <h2>Photo Filters</h2>
                  <span>Apply instant AI filters to your image</span>
                </div>

                <div className="filters-grid">
                  {filterPresets.map((filter) => (
                    <button
                      key={filter.label}
                      type="button"
                      className="filter-chip"
                      onClick={() => handleApplyFilter(filter.prompt)}
                      title={filter.prompt}
                    >
                      <div className="filter-label">{filter.label}</div>
                      <div className="filter-category">{filter.category}</div>
                    </button>
                  ))}
                </div>

                <div className="filter-instructions">
                  <p>Click any filter to instantly apply it to your image using AI. Each filter uses carefully crafted prompts for professional results.</p>
                </div>
              </div>
            )}

            <div className="preset-grid">
              {presetPrompts.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="preset-chip"
                  onClick={() => handlePresetApply(preset.prompt)}
                  title={preset.prompt}
                >
                  {preset.label}
                </button>
              ))}
            </div>


            <button
              onClick={handleProcess}
              disabled={isLoading || (mode === 'edit' && !image) || !prompt.trim()}
              className="edit-btn"
              title="Ctrl/Cmd + Enter"
              type="button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="spinner" size={20} />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  {mode === 'edit' ? 'Run Edit' : 'Generate Image'}
                </>
              )}
            </button>

            {error && (
              <div className="error-message">
                <strong>Error:</strong> {error}
              </div>
            )}

            {!apiConfigured && !error && (
              <div className="warning-message">⚠️ API key not configured</div>
            )}
          </div>
        </aside>
      </div>

      <footer className="status-bar">
        <span>Zoom 100%</span>
        <span>Document RGB • 16-bit</span>
        <span>{isLoading ? 'Working...' : 'Idle'}</span>
      </footer>
    </div>
  );
}

export default App;
