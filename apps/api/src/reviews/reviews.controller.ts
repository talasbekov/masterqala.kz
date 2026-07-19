import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { SubmitReviewDto } from './dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('orders/:id/review')
  submitForOrder(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: SubmitReviewDto) {
    return this.reviews.submitForOrder(user.id, id, dto);
  }

  @Post('planned-orders/:id/review')
  submitForPlannedOrder(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: SubmitReviewDto) {
    return this.reviews.submitForPlannedOrder(user.id, id, dto);
  }
}
