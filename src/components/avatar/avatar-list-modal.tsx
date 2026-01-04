"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MediaModal } from "@/components/ui/media-modal"
import { Zap, Wand2, Loader2, Sparkles, Video, Sliders, ChevronDown, ChevronUp } from "lucide-react"
import { generateAnimationFromAvatar } from "@/actions/generate-animation"
import {
  RemixOptions,
  RemixIntensity,
  PreserveElement,
  StylePreset,
  DEFAULT_REMIX_OPTIONS,
  INTENSITY_LABELS,
  PRESERVE_ELEMENT_LABELS,
  STYLE_PRESET_LABELS,
} from "@/lib/remix-options"

interface Avatar {
  id: string
  imageUrl: string | null
  prompt: any
  createdAt: Date
  updatedAt: Date
}

interface AvatarListModalProps {
  avatar: Avatar
  onClose: () => void
  onRemix: (avatarId: string, instructions: string, productImageUrls?: string[], remixOptions?: Partial<RemixOptions>) => Promise<void>
  isGenerating?: boolean
}

export function AvatarListModal({ avatar, onClose, onRemix, isGenerating = false }: AvatarListModalProps) {
  const router = useRouter()
  const [isRemixing, setIsRemixing] = useState(false)
  const [remixInstructions, setRemixInstructions] = useState("")
  const [isAnimating, setIsAnimating] = useState(false)
  const [animePrompt, setAnimePrompt] = useState("")
  const [isGeneratingAnimation, setIsGeneratingAnimation] = useState(false)

  // Product selection state
  const [products, setProducts] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [selectedProductImageUrls, setSelectedProductImageUrls] = useState<string[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)

  // Remix options state
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [remixIntensity, setRemixIntensity] = useState<RemixIntensity>(DEFAULT_REMIX_OPTIONS.intensity)
  const [preserveElements, setPreserveElements] = useState<PreserveElement[]>(DEFAULT_REMIX_OPTIONS.preserveElements)
  const [stylePreset, setStylePreset] = useState<StylePreset>(DEFAULT_REMIX_OPTIONS.stylePreset)

  // Fetch products when opening panels
  const fetchProducts = async () => {
    if (products.length > 0) return

    setIsLoadingProducts(true)
    try {
      const { getProducts } = await import("@/actions/products")
      const userProducts = await getProducts()
      setProducts(userProducts)
    } catch (error) {
      console.error("Failed to fetch products:", error)
    } finally {
      setIsLoadingProducts(false)
    }
  }

  const handleRemixSubmit = async () => {
    if (!remixInstructions.trim()) {
      return
    }

    // Use selected product image URLs (or empty array if none selected)
    const productImageUrls = selectedProductImageUrls.length > 0
      ? selectedProductImageUrls
      : undefined

    // Build remix options
    const remixOptions: Partial<RemixOptions> = {
      intensity: remixIntensity,
      preserveElements: preserveElements,
      stylePreset: stylePreset,
      variationCount: 1,
    }

    await onRemix(avatar.id, remixInstructions.trim(), productImageUrls, remixOptions)
    setIsRemixing(false)
    setRemixInstructions("")
    setSelectedProductId("")
    setSelectedProductImageUrls([])
    // Reset remix options to defaults
    setRemixIntensity(DEFAULT_REMIX_OPTIONS.intensity)
    setPreserveElements(DEFAULT_REMIX_OPTIONS.preserveElements)
    setStylePreset(DEFAULT_REMIX_OPTIONS.stylePreset)
    setShowAdvancedOptions(false)
  }

  const handlePreserveElementToggle = (element: PreserveElement) => {
    setPreserveElements(prev =>
      prev.includes(element)
        ? prev.filter(e => e !== element)
        : [...prev, element]
    )
  }

  const handleRemixClick = () => {
    setIsAnimating(false) // Close animate if open
    if (!isRemixing) {
      fetchProducts()
    }
    setIsRemixing(!isRemixing)
  }

  const handleAnimeClick = () => {
    setIsRemixing(false) // Close remix if open
    setIsAnimating(!isAnimating)
  }

  const handleGenerateAnimation = async () => {
    if (!animePrompt.trim()) {
      return
    }

    setIsGeneratingAnimation(true)
    try {
      // Avatar animations cannot include products (Veo limitation: cannot mix avatar + products)
      await generateAnimationFromAvatar(avatar.id, animePrompt)
      // Close modals and navigate to animations page
      setIsAnimating(false)
      onClose() // Close the avatar modal too
      setAnimePrompt("")
      router.push("/app/animations")
    } catch (error) {
      console.error("Failed to generate animation:", error)
      alert("Failed to generate animation. Please try again.")
      setIsGeneratingAnimation(false)
    }
  }

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId)
    // Reset selected images when product changes
    setSelectedProductImageUrls([])
  }

  const handleImageToggle = (imageUrl: string) => {
    setSelectedProductImageUrls(prev => {
      if (prev.includes(imageUrl)) {
        return prev.filter(url => url !== imageUrl)
      } else {
        // For remix, allow multiple images
        return [...prev, imageUrl]
      }
    })
  }

  const selectedProduct = products.find(p => p.id === selectedProductId)
  const productImages = selectedProduct?.images || []

  // Product selector component - only used for remix (not animation)
  const productSelector = (
    <div className="mb-4">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        Attach a Product (Optional)
      </label>
      <select
        value={selectedProductId}
        onChange={(e) => handleProductSelect(e.target.value)}
        disabled={isGenerating || isGeneratingAnimation || isLoadingProducts}
        className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 appearance-none"
      >
        <option value="">Select a product...</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.title}
          </option>
        ))}
      </select>
      {selectedProductId && (
        <div className="mt-3">
          <div className="text-xs text-zinc-500 flex items-center gap-2 mb-2">
            <span>Selected: {selectedProduct?.title}</span>
            <button
              onClick={() => {
                setSelectedProductId("")
                setSelectedProductImageUrls([])
              }}
              className="text-red-500 hover:text-red-600"
            >
              Remove
            </button>
          </div>
          {productImages.length > 0 && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                Select images to use ({selectedProductImageUrls.length}/3 selected)
              </label>
              {selectedProductImageUrls.length >= 3 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                  Maximum 3 product images can be used for video generation.
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {productImages.map((imageUrl: string, index: number) => {
                  const isSelected = selectedProductImageUrls.includes(imageUrl)
                  const isDisabled = !isSelected && selectedProductImageUrls.length >= 3
                  return (
                    <div
                      key={index}
                      onClick={() => !isDisabled && handleImageToggle(imageUrl)}
                      className={`relative rounded-md overflow-hidden border-2 transition-all ${
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-500/20 cursor-pointer"
                          : isDisabled
                            ? "border-zinc-200 dark:border-zinc-800 cursor-not-allowed opacity-50"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer"
                      }`}
                    >
                      <img
                        src={imageUrl}
                        alt={`Product image ${index + 1}`}
                        className="w-full h-20 object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="bg-blue-500 rounded-full p-1">
                            <svg
                              className="w-4 h-4 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const sidePanel = (
    <>
      {/* Remix Panel */}
      {isRemixing && (
        <div className="w-[400px] mr-4 bg-card rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto max-h-[576px] animate-in slide-in-from-left-1/2 flex flex-col">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Remix Avatar</h3>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                What would you like to change?
              </label>
              <textarea
                value={remixInstructions}
                onChange={(e) => setRemixInstructions(e.target.value)}
                placeholder="e.g., change shirt color to black, make hair blonde, add sunglasses..."
                className="w-full min-h-[80px] px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 resize-none"
                disabled={isGenerating}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-2">
                Describe the changes you want to make to this avatar. The image will be used as a reference.
              </p>
            </div>

            {/* Advanced Remix Options */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4" />
                  <span>Advanced Options</span>
                </div>
                {showAdvancedOptions ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showAdvancedOptions && (
                <div className="p-3 space-y-4 bg-white dark:bg-zinc-950">
                  {/* Remix Intensity */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                      Remix Intensity
                    </label>
                    <div className="flex gap-2">
                      {(Object.keys(INTENSITY_LABELS) as RemixIntensity[]).map((intensity) => (
                        <button
                          key={intensity}
                          type="button"
                          onClick={() => setRemixIntensity(intensity)}
                          disabled={isGenerating}
                          className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-all ${
                            remixIntensity === intensity
                              ? "bg-blue-500 text-white"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          }`}
                          title={INTENSITY_LABELS[intensity].description}
                        >
                          {INTENSITY_LABELS[intensity].label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {INTENSITY_LABELS[remixIntensity].description}
                    </p>
                  </div>

                  {/* Style Preset */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                      Style Preset
                    </label>
                    <select
                      value={stylePreset}
                      onChange={(e) => setStylePreset(e.target.value as StylePreset)}
                      disabled={isGenerating}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
                    >
                      {(Object.keys(STYLE_PRESET_LABELS) as StylePreset[]).map((preset) => (
                        <option key={preset} value={preset}>
                          {STYLE_PRESET_LABELS[preset].label} - {STYLE_PRESET_LABELS[preset].description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Preserve Elements */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                      Preserve Elements (optional)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(PRESERVE_ELEMENT_LABELS) as PreserveElement[]).map((element) => (
                        <button
                          key={element}
                          type="button"
                          onClick={() => handlePreserveElementToggle(element)}
                          disabled={isGenerating}
                          className={`px-2 py-1 text-xs rounded-full transition-all border ${
                            preserveElements.includes(element)
                              ? "bg-green-500 text-white border-green-500"
                              : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                          }`}
                          title={PRESERVE_ELEMENT_LABELS[element].description}
                        >
                          {PRESERVE_ELEMENT_LABELS[element].label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Select elements to keep unchanged during remix
                    </p>
                  </div>
                </div>
              )}
            </div>

            {productSelector}
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              onClick={handleRemixSubmit}
              disabled={isGenerating || !remixInstructions.trim()}
              className="w-full gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate Remix
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Animate Panel */}
      {isAnimating && (
        <div className="w-[400px] mr-4 bg-card rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto max-h-[576px] animate-in slide-in-from-left-1/2 flex flex-col">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <Video className="h-4 w-4 text-blue-500" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Animate Avatar</h3>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                How would you like to animate this avatar?
              </label>
              <textarea
                value={animePrompt}
                onChange={(e) => setAnimePrompt(e.target.value)}
                placeholder="e.g., A gentle swaying motion, walking forward, waving hello..."
                className="w-full min-h-[80px] px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 resize-none"
                disabled={isGeneratingAnimation}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
                Enter a prompt describing how you want to animate this avatar. The animation will be generated using the avatar image and your prompt.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAnimating(false)
                setAnimePrompt("")
              }}
              disabled={isGeneratingAnimation}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateAnimation}
              disabled={!animePrompt.trim() || isGeneratingAnimation}
              className="flex-1 gap-2"
            >
              {isGeneratingAnimation ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Video className="h-4 w-4" />
                  Generate Animation
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  )

  const controlButtons = (
    <>
      <button
        onClick={handleRemixClick}
        disabled={!avatar.imageUrl}
        className={`h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border ${isRemixing
          ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
          : !avatar.imageUrl
            ? "bg-card text-foreground/50 border-zinc-200 dark:border-zinc-800 cursor-not-allowed opacity-50"
            : "bg-card text-foreground hover:bg-muted border-zinc-200 dark:border-zinc-800"
          }`}
        aria-label="Remix content"
        title={!avatar.imageUrl ? "Avatar must have an image to remix" : "Remix this avatar"}
      >
        <Zap size={18} />
        <span className="text-xs hidden sm:inline">{isRemixing ? "Done" : "Remix"}</span>
      </button>

      <button
        onClick={handleAnimeClick}
        className={`h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border ${isAnimating
          ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
          : "bg-card text-foreground hover:bg-muted border-zinc-200 dark:border-zinc-800"
          }`}
        aria-label="Animate avatar"
        title="Animate this avatar"
      >
        <Video size={18} />
        <span className="text-xs hidden sm:inline">{isAnimating ? "Done" : "Animate"}</span>
      </button>
    </>
  )

  return (
    <MediaModal
      mediaType="image"
      mediaUrl={avatar.imageUrl}
      isLoading={!avatar.imageUrl}
      loadingText="Generating..."
      onClose={onClose}
      prompt={avatar.prompt}
      sidePanel={sidePanel}
      controlButtons={controlButtons}
      isPanelOpen={isRemixing || isAnimating}
    />
  )
}
