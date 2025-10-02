"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Upload, X } from "lucide-react"

interface IngredientImageUploadProps {
  ingredientId: string
  existingImageUrl?: string
  existingImageDescription?: string
  onUploadComplete: (imageUrl: string, imageDescription: string) => void
}

export function IngredientImageUpload({
  ingredientId,
  existingImageUrl,
  existingImageDescription = "",
  onUploadComplete,
}: IngredientImageUploadProps) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageDescription, setImageDescription] = useState(existingImageDescription)
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingImageUrl || null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setImageFile(file)

    if (file) {
      const objectUrl = URL.createObjectURL(file)
      setPreviewUrl(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    } else {
      setPreviewUrl(existingImageUrl || null)
    }
  }

  const clearImage = () => {
    setImageFile(null)
    setPreviewUrl(null)
  }

  const uploadImage = async () => {
    if (!imageFile) {
      if (existingImageUrl) {
        // Just update the description if there's an existing image
        onUploadComplete(existingImageUrl, imageDescription)
        return
      }
      toast({
        title: "No image selected",
        description: "Please select an image to upload",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)

    try {
      // Create a FormData object to send the file
      const formData = new FormData()
      formData.append("file", imageFile)
      formData.append("path", `ingredients/${ingredientId}`)

      // Use the local API endpoint for file upload
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to upload image")
      }

      const data = await response.json()

      // Call the callback with the new URL and description
      onUploadComplete(data.url, imageDescription)

      toast({
        title: "Image uploaded",
        description: "The ingredient image has been uploaded successfully",
      })
    } catch (error) {
      console.error("Error uploading image:", error)
      toast({
        title: "Upload failed",
        description: "There was an error uploading the image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ingredient-image">Ingredient Image</Label>
        <div className="flex items-center gap-2">
          <Input
            id="ingredient-image"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          {previewUrl && (
            <Button variant="outline" size="icon" onClick={clearImage} disabled={isUploading} type="button">
              <X className="h-4 w-4" />
              <span className="sr-only">Clear image</span>
            </Button>
          )}
        </div>
      </div>

      {previewUrl && (
        <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-md border">
          <img
            src={previewUrl || "/placeholder.svg?height=300&width=400"}
            alt="Ingredient preview"
            className="h-full w-full object-contain"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="image-description">Image Description</Label>
        <Textarea
          id="image-description"
          placeholder="Describe the visual characteristics of this ingredient for specification purposes..."
          value={imageDescription}
          onChange={(e) => setImageDescription(e.target.value)}
          disabled={isUploading}
          className="min-h-[100px]"
        />
      </div>

      <Button
        onClick={uploadImage}
        disabled={isUploading || (!imageFile && !existingImageUrl)}
        className="w-full sm:w-auto"
        type="button"
      >
        {isUploading ? (
          <span>Uploading...</span>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            {existingImageUrl ? "Update Image" : "Upload Image"}
          </>
        )}
      </Button>
    </div>
  )
}
