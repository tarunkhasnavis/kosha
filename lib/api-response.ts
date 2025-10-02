import { NextResponse } from 'next/server'

export type ApiResponse<T = any> = {
  data?: T
  error?: string
  message?: string
  success: boolean
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function successResponse<T>(data: T, message?: string) {
  return NextResponse.json({
    success: true,
    data,
    message
  } as ApiResponse<T>)
}

export function errorResponse(error: ApiError | Error | unknown, statusCode = 500) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.details
      } as ApiResponse,
      { status: error.statusCode }
    )
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message
      } as ApiResponse,
      { status: statusCode }
    )
  }

  return NextResponse.json(
    {
      success: false,
      error: 'An unexpected error occurred'
    } as ApiResponse,
    { status: 500 }
  )
}