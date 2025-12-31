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
  onRemix: (avatarId: string, instructions: string, productImageUrl?: string) => Promise<void>
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

    // Find selected product image URL if any
    let productImageUrl = undefined
    if (selectedProductId) {
      const product = products.find(p => p.id === selectedProductId)
      // Use the first image of the product if available
      if (product && product.images && product.images.length > 0) {
        productImageUrl = product.images[0]
      }
    }

    await onRemix(avatar.id, remixInstructions.trim(), productImageUrl)
    setIsRemixing(false)
    setRemixInstructions("")
    setSelectedProductId("")
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
      // Find selected product image URL if any
      let productImageUrl = undefined
      if (selectedProductId) {
        const product = products.find(p => p.id === selectedProductId)
        // Use the first image of the product if available
        if (product && product.images && product.images.length > 0) {
          productImageUrl = product.images[0]
        }
      }

      await generateAnimationFromAvatar(avatar.id, animePrompt, productImageUrl)
      // Close modals and navigate to animations page
      setIsAnimating(false)
      onClose() // Close the avatar modal too
      setAnimePrompt("")
      setSelectedProductId("")
      router.push("/app/animations")
    } catch (error) {
      console.error("Failed to generate animation:", error)
      alert("Failed to generate animation. Please try again.")
      setIsGeneratingAnimation(false)
    }
  }

  const productSelector = (
    <div className="mb-4">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        Attach a Product (Optional)
      </label>
      <select
        value={selectedProductId}
        onChange={(e) => setSelectedProductId(e.target.value)}
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
        <div className="mt-2 text-xs text-zinc-500 flex items-center gap-2">
          <span>Selected: {products.find(p => p.id === selectedProductId)?.title}</span>
          <button
            onClick={() => setSelectedProductId("")}
            className="text-red-500 hover:text-red-600"
          >
            Remove
          </button>
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
