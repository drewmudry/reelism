"use client"

import { useState, ReactNode } from "react"
import { X, Copy, Check, Image, Loader2, Download } from "lucide-react"
import { getDownloadUrl } from "@/actions/media"

interface MediaModalProps {
    mediaType: "image" | "video"
    mediaUrl: string | null
    isLoading?: boolean
    loadingText?: string
    loadingSubtext?: string
    onClose: () => void
    prompt?: string | object
    sidePanel?: ReactNode
    controlButtons?: ReactNode
    isPanelOpen?: boolean
    showCopyButtons?: boolean
    showDownloadButton?: boolean
}

export function MediaModal({
    mediaType,
    mediaUrl,
    isLoading = false,
    loadingText = "Generating...",
    loadingSubtext,
    onClose,
    prompt,
    sidePanel,
    controlButtons,
    isPanelOpen = false,
    showCopyButtons = true,
    showDownloadButton = false,
}: MediaModalProps) {
    const [hasCopiedPrompt, setHasCopiedPrompt] = useState(false)
    const [hasCopiedUrl, setHasCopiedUrl] = useState(false)

    const handleCopyPrompt = () => {
        if (!prompt) return
        const text = typeof prompt === "string" ? prompt : JSON.stringify(prompt)
        navigator.clipboard.writeText(text)
        setHasCopiedPrompt(true)
        setTimeout(() => setHasCopiedPrompt(false), 2000)
    }

    const handleCopyUrl = async () => {
        if (!mediaUrl) return

        if (mediaType === "image") {
            try {
                const downloadUrl = await getDownloadUrl(mediaUrl)
                const response = await fetch(downloadUrl)
                let blob = await response.blob()

                // Clipboard API specifies that 'image/png' is the only mandatory supported type for writing images.
                if (blob.type !== "image/png") {
                    try {
                        const imageBitmap = await createImageBitmap(blob)
                        const canvas = document.createElement("canvas")
                        canvas.width = imageBitmap.width
                        canvas.height = imageBitmap.height
                        const ctx = canvas.getContext("2d")
                        if (ctx) {
                            ctx.drawImage(imageBitmap, 0, 0)
                            const pngBlob = await new Promise<Blob | null>((resolve) =>
                                canvas.toBlob(resolve, "image/png")
                            )
                            if (pngBlob) {
                                blob = pngBlob
                            }
                        }
                    } catch (conversionError) {
                        console.error("Failed to convert image to PNG:", conversionError)
                        // Fallback: try to copy original blob anyway, though it might fail
                    }
                }

                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob,
                    }),
                ])
                setHasCopiedUrl(true)
                setTimeout(() => setHasCopiedUrl(false), 2000)
            } catch (error) {
                console.error("Failed to copy image:", error)
            }
        } else {
            navigator.clipboard.writeText(mediaUrl)
            setHasCopiedUrl(true)
            setTimeout(() => setHasCopiedUrl(false), 2000)
        }
    }

    const handleDownload = async () => {
        if (!mediaUrl) return
        try {
            // Get a presigned download URL to bypass CORS
            const downloadUrl = await getDownloadUrl(mediaUrl)
            const response = await fetch(downloadUrl)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = mediaType === "video" ? "animation.mp4" : "image.png"
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error("Failed to download:", error)
        }
    }

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={onClose} />

            {/* Modal Container */}
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
                <div
                    className={`pointer-events-auto transition-all duration-500 ease-out w-full ${isPanelOpen ? "max-w-[900px]" : "max-w-[420px]"
                        }`}
                >
                    <div className="flex gap-4">
                        {/* Main Modal */}
                        <div className="flex-shrink-0">
                            <div className="bg-card rounded-lg overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 w-96">
                                {isLoading || !mediaUrl ? (
                                    <div className="w-full aspect-[9/16] flex flex-col items-center justify-center gap-3 text-zinc-500">
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                        <p className="text-sm">{loadingText}</p>
                                        {loadingSubtext && <p className="text-xs text-zinc-400">{loadingSubtext}</p>}
                                    </div>
                                ) : mediaType === "image" ? (
                                    <img
                                        src={mediaUrl}
                                        alt="Media"
                                        className="w-full h-auto aspect-[9/16] object-cover"
                                    />
                                ) : (
                                    <video
                                        src={mediaUrl}
                                        className="w-full h-auto aspect-[9/16] object-cover"
                                        controls
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                    />
                                )}
                            </div>
                        </div>

                        {/* Side Panel */}
                        {sidePanel}

                        {/* Control Buttons */}
                        <div className="flex flex-col gap-2 flex-shrink-0">
                            <button
                                onClick={onClose}
                                className="h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800"
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>

                            {showCopyButtons && (
                                <div className="flex gap-2">
                                    {prompt && (
                                        <button
                                            onClick={handleCopyPrompt}
                                            className="h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800"
                                            aria-label="Copy prompt"
                                            title="Copy Prompt"
                                        >
                                            {hasCopiedPrompt ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                        </button>
                                    )}

                                    <button
                                        onClick={handleCopyUrl}
                                        className="h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800"
                                        aria-label="Copy URL"
                                        title="Copy URL"
                                        disabled={!mediaUrl}
                                    >
                                        {hasCopiedUrl ? <Check size={18} className="text-green-500" /> : <Image size={18} />}
                                    </button>
                                </div>
                            )}

                            {showDownloadButton && (
                                <button
                                    onClick={handleDownload}
                                    className="h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800"
                                    aria-label="Download media"
                                    title="Download"
                                    disabled={!mediaUrl}
                                >
                                    <Download size={18} />
                                </button>
                            )}

                            {/* Additional Control Buttons */}
                            {controlButtons}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

