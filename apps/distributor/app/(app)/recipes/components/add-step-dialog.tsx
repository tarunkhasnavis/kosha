"use client"

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Textarea, Input } from "@kosha/ui"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

const formSchema = z.object({
  stepNumber: z.string().min(1, { message: "Please enter a step number" }),
  instruction: z.string().min(5, { message: "Instruction must be at least 5 characters" }),
  time: z.string().optional(),
  temperature: z.string().optional(),
})

type AddStepDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddStep: (data: any) => void
  currentStepCount: number
}

export function AddStepDialog({ open, onOpenChange, onAddStep, currentStepCount }: AddStepDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stepNumber: (currentStepCount + 1).toString(),
      instruction: "",
      time: "",
      temperature: "",
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    const newStep = {
      id: `step-${Date.now()}`,
      stepNumber: Number.parseInt(values.stepNumber),
      instruction: values.instruction,
      time: values.time ? values.time : undefined,
      temperature: values.temperature ? values.temperature : undefined,
    }

    onAddStep(newStep)
    form.reset({
      stepNumber: (currentStepCount + 2).toString(),
      instruction: "",
      time: "",
      temperature: "",
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Step</DialogTitle>
          <DialogDescription>Add a new instruction step to this recipe.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="stepNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Step Number</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="instruction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instruction</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter detailed instructions for this step"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 10 minutes" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperature (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 350°F" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit">Add Step</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
