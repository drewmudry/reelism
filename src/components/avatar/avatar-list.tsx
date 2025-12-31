"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAvatars } from "@/actions/get-avatars"
import { remixAvatar } from "@/actions/generate-avatar"
import { Loader2 } from "lucide-react"
import { AvatarListModal } from "./avatar-list-modal"

interface Avatar {
  id: string
  imageUrl: string | null
  prompt: any
  createdAt: Date
  updatedAt: Date
}

export function AvatarList() {
  const router = useRouter()
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAvatars = async () => {
      try {
        const data = await getAvatars()
        setAvatars(data)
        setIsLoading(false)
      } catch (err) {
        setError("Failed to load avatars")
        setIsLoading(false)
      }
    }

    fetchAvatars()
  }, [])

  const handleRemix = async (avatarId: string, instructions: string, productImageUrls?: string[]) => {
    if (!instructions.trim()) return;
    setIsGenerating(true);
    try {
      await remixAvatar(avatarId, instructions, productImageUrls);
      // Refresh the avatars list to show the new remix
      const data = await getAvatars();
      setAvatars(data);
      // Close the modal
      setSelectedAvatar(null);
      // Refresh the page to show the new avatar
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remix avatar");
      alert(err instanceof Error ? err.message : "Failed to remix avatar");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleAvatarClick(avatar: Avatar) {
    setSelectedAvatar(avatar)
  }

  function handleClose() {
    setSelectedAvatar(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
        Error: {error}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {avatars.map((avatar) => (
          <div
            key={avatar.id}
            onClick={() => handleAvatarClick(avatar)}
            className="group relative cursor-pointer overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 aspect-[9/16] transition-transform hover:scale-[1.02] border border-zinc-200 dark:border-zinc-800"
          >
            {avatar.imageUrl ? (
              <img
                src={avatar.imageUrl || "/placeholder.svg"}
                alt="Avatar"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs font-medium">Generating...</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
          </div>
        ))}
      </div>

      {selectedAvatar && (
        <AvatarListModal
          avatar={selectedAvatar}
          onClose={handleClose}
          onRemix={handleRemix}
          isGenerating={isGenerating}
        />
      )}
    </>
  )
}
