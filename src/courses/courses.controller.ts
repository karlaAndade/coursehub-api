import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CoursesUseCases } from './application/courses.use-cases.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { CoursesQueryDto } from './dto/courses-query.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { UserRole } from '../users/user-role.enum.js';

type RequestWithUser = Request & { user: AuthenticatedUser };

@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesUseCases) {}
  @Get()
  findAll(@Query() query: CoursesQueryDto) {
    return this.courses.findAll(query);
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.courses.findOne(Number(id));
  }
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  create(
    @Body() createCourseDto: CreateCourseDto,
    @Req() request: RequestWithUser,
  ) {
    return this.courses.create(createCourseDto, request.user);
  }
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCourseDto,
    @Req() request: RequestWithUser,
  ) {
    return this.courses.update(id, body, request.user);
  }
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.courses.remove(id);
  }
}
