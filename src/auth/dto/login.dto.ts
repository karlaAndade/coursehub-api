import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
