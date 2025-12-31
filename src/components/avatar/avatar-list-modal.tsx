"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MediaModal } from "@/components/ui/media-modal"
import { Zap, Wand2, Loader2, Sparkles, Video } from "lucide-react"
import { generateAnimationFromAvatar } from "@/actions/generate-animation"

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
  onRemix: (avatarId: string, instructions: string, productImageUrls?: string[]) => Promise<void>
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

    await onRemix(avatar.id, remixInstructions.trim(), productImageUrls)
    setIsRemixing(false)
    setRemixInstructions("")
    setSelectedProductId("")
    setSelectedProductImageUrls([])
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
    if (!isAnimating) {
      fetchProducts()
    }
    setIsAnimating(!isAnimating)
  }

  const handleGenerateAnimation = async () => {
    if (!animePrompt.trim()) {
      return
    }

    setIsGeneratingAnimation(true)
    try {
      // Use selected product image URLs (or empty array if none selected)
      const productImageUrls = selectedProductImageUrls.length > 0 
        ? selectedProductImageUrls 
        : undefined

      await generateAnimationFromAvatar(avatar.id, animePrompt, productImageUrls)
      // Close modals and navigate to animations page
      setIsAnimating(false)
      onClose() // Close the avatar modal too
      setAnimePrompt("")
      setSelectedProductId("")
      setSelectedProductImageUrls([])
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
        return [...prev, imageUrl]
      }
    })
  }

  const selectedProduct = products.find(p => p.id === selectedProductId)
  const productImages = selectedProduct?.images || []

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
                Select images to use ({selectedProductImageUrls.length} selected)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {productImages.map((imageUrl: string, index: number) => {
                  const isSelected = selectedProductImageUrls.includes(imageUrl)
                  return (
                    <div
                      key={index}
                      onClick={() => handleImageToggle(imageUrl)}
                      className={`relative cursor-pointer rounded-md overflow-hidden border-2 transition-all ${
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-500/20"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
                Describe the changes you want to make to this avatar. The image will be used as a reference.
              </p>
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

            {productSelector}
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAnimating(false)
                setAnimePrompt("")
                setSelectedProductId("")
                setSelectedProductImageUrls([])
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
