import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('enrollments')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(dto);
  }

  @Get('enrollments')
  findAll(@Query() query: QueryEnrollmentsDto) {
    return this.enrollmentsService.findAll(query);
  }

  @Get('students/:studentId/enrollments')
  findByStudent(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.enrollmentsService.findByStudent(studentId);
  }

  @Get('courses/:courseId/enrollments')
  findByCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.enrollmentsService.findByCourse(courseId);
  }

  @Delete('enrollments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.enrollmentsService.remove(id);
  }
}
