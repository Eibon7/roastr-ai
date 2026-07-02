import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from "@nestjs/common";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";
import { RoastPipelineService } from "./roast-pipeline.service";
import { AutoApproveService } from "./auto-approve.service";
import { isValidTone } from "./tones";

type GenerateBody = {
  commentId: string;
  commentText: string;
  severityScore: number;
  platform: string;
  accountId: string;
  tone: string;
};

type ApproveBody = {
  /** The generated text the user approved. Never persisted — used for immediate publication. */
  approvedText: string;
};

@Controller("roast")
@UseGuards(SubscriptionGuard)
export class RoastController {
  constructor(
    private readonly pipeline: RoastPipelineService,
    private readonly autoApprove: AutoApproveService,
  ) {}

  @Post("generate")
  async generate(
    @Body() body: GenerateBody,
    @Req() req: { user?: { id: string } },
  ) {
    if (!req.user?.id) throw new NotFoundException();

    if (!body.commentId || !body.commentText || !body.platform || !body.accountId) {
      throw new BadRequestException("commentId, commentText, platform and accountId are required.");
    }
    if (!isValidTone(body.tone)) {
      throw new BadRequestException(`Invalid tone: ${body.tone}`);
    }

    const result = await this.pipeline.generate({
      userId: req.user.id,
      commentId: body.commentId,
      commentText: body.commentText,
      severityScore: body.severityScore ?? 0.5,
      platform: body.platform,
      accountId: body.accountId,
      tone: body.tone,
    });

    return {
      candidateId: result.candidateId,
      /** Ephemeral text — display once, do not store on client. */
      generatedText: result.generatedText,
      isValid: result.isValid,
      violations: result.violations,
      truncatedText: result.truncatedText,
    };
  }

  @Get("candidates")
  async listCandidates(@Req() req: { user?: { id: string } }) {
    if (!req.user?.id) throw new NotFoundException();
    const candidates = await this.pipeline.listPendingReview(req.user.id);
    return { candidates };
  }

  @Patch("candidates/:id/approve")
  @HttpCode(HttpStatus.NO_CONTENT)
  async approve(
    @Param("id") id: string,
    @Body() body: ApproveBody,
    @Req() req: { user?: { id: string } },
  ) {
    if (!req.user?.id) throw new NotFoundException();
    if (!body.approvedText?.trim()) {
      throw new BadRequestException("approvedText is required to publish.");
    }
    // TODO: call platform adapter to publish approvedText
    // For now, mark as published
    await this.pipeline.markPublished(id, req.user.id);
  }

  @Patch("candidates/:id/discard")
  @HttpCode(HttpStatus.NO_CONTENT)
  async discard(
    @Param("id") id: string,
    @Req() req: { user?: { id: string } },
  ) {
    if (!req.user?.id) throw new NotFoundException();
    await this.pipeline.discard(id, req.user.id);
  }

  @Get("accounts/:accountId/auto-approve")
  async getAutoApprove(
    @Param("accountId") accountId: string,
    @Req() req: { user?: { id: string } },
  ) {
    if (!req.user?.id) throw new NotFoundException();
    return this.autoApprove.getConfig(req.user.id, accountId);
  }

  @Patch("accounts/:accountId/auto-approve")
  @HttpCode(HttpStatus.NO_CONTENT)
  async setAutoApprove(
    @Param("accountId") accountId: string,
    @Body() body: { enabled: boolean },
    @Req() req: { user?: { id: string } },
  ) {
    if (!req.user?.id) throw new NotFoundException();
    if (typeof body.enabled !== "boolean") {
      throw new BadRequestException("enabled must be a boolean.");
    }
    await this.autoApprove.setAutoApprove(req.user.id, accountId, body.enabled);
  }
}
