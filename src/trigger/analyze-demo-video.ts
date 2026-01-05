import { task, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/index";
import { demos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { analyzeVideoWithGemini } from "@/lib/ai";

export const analyzeDemoVideoTask = task({
  id: "analyze-demo-video",
  maxDuration: 600, // 10 minutes max for video analysis
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload: { demoId: string; videoUrl: string; mimeType: string }) => {
    logger.log("Starting video analysis", {
      demoId: payload.demoId,
      mimeType: payload.mimeType,
    });

    try {
      // Verify the demo exists
      const [demo] = await db
        .select()
        .from(demos)
        .where(eq(demos.id, payload.demoId))
        .limit(1);

      if (!demo) {
        throw new Error(`Demo with id ${payload.demoId} not found`);
      }

      // Analyze the video with Gemini Flash
      logger.log("Analyzing video with Gemini Flash", {
        videoUrl: payload.videoUrl,
      });

      const analysis = await analyzeVideoWithGemini(
        payload.videoUrl,
        payload.mimeType
      );

      logger.log("Video analysis completed", {
        demoId: payload.demoId,
        analysisLength: analysis.length,
      });

      // Update the demo record with the analysis
      const [updated] = await db
        .update(demos)
        .set({
          description: analysis,
          updatedAt: new Date(),
        })
        .where(eq(demos.id, payload.demoId))
        .returning();

      if (!updated) {
        throw new Error("Failed to update demo with analysis");
      }

      logger.log("Demo updated with video analysis", {
        demoId: payload.demoId,
      });

      return {
        success: true,
        demoId: payload.demoId,
        analysisLength: analysis.length,
      };
    } catch (error) {
      logger.error("Video analysis failed", {
        demoId: payload.demoId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Don't throw - we want to log the error but not fail the task
      // The demo record will remain without analysis
      return {
        success: false,
        demoId: payload.demoId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

