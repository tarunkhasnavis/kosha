"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"
import { IngredientImageUpload } from "@/app/ingredients/components/ingredient-image-upload"
import { Loader2 } from "lucide-react"

interface Ingredient {
  id: string
  name: string
  description?: string
  storage_instructions?: string
  image_url?: string
  image_description?: string
}

const mockIngredient: Ingredient = {
  id: "1",
  name: "Flour (All-Purpose)",
  description: "Premium all-purpose wheat flour for general baking needs",
  storage_instructions: "Store in a cool, dry place away from strong odors",
  image_url: "/bag-of-flour.png",
  image_description: "Fine, white powdered flour with consistent texture.",
}

export default function IngredientEditPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, setIsPending] = useState(false)

  const [name, setName] = useState(mockIngredient.name)
  const [description, setDescription] = useState(mockIngredient.description || "")
  const [storageInstructions, setStorageInstructions] = useState(mockIngredient.storage_instructions || "")
  const [imageUrl, setImageUrl] = useState(mockIngredient.image_url || "")
  const [imageDescription, setImageDescription] = useState(mockIngredient.image_description || "")

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsPending(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Success",
        description: "Ingredient updated successfully",
      })
      router.push(`/ingredients/${params.id}`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update ingredient",
        variant: "destructive",
      })
    } finally {
      setIsPending(false)
    }
  }

  const handleImageUploadComplete = (newImageUrl: string, newImageDescription: string) => {
    setImageUrl(newImageUrl)
    setImageDescription(newImageDescription)
  }

  return (
    <div className="container mx-auto py-10 pl-64">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edit Ingredient</h1>
      </div>
      <Separator className="my-4" />

      <form onSubmit={onSubmit} className="space-y-8">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Ingredient name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Ingredient description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="storage">Storage Instructions</Label>
          <Textarea
            id="storage"
            placeholder="Storage instructions"
            value={storageInstructions}
            onChange={(e) => setStorageInstructions(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-base font-medium">Visual Specification</Label>
          <IngredientImageUpload
            ingredientId={params.id}
            existingImageUrl={imageUrl}
            existingImageDescription={imageDescription}
            onUploadComplete={handleImageUploadComplete}
          />
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update Ingredient
        </Button>
      </form>
    </div>
  )
}
