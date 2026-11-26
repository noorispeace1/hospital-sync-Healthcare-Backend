import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserServices } from "./user.service";

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
	if (!req.file) {
		throw new AppError(httpStatus.BAD_REQUEST, "No File Provided.");
	}

	const userId = req.user?.userId;

	const result = await UserServices.uploadProfileImage(
		req.file?.buffer,
		userId!,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile image uploaded successfully",
		data: result,
	});
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;

	const result = await UserServices.updateProfile(userId!, req.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile updated successfully",
		data: result,
	});
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;

	const result = await UserServices.changePassword(userId!, req.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Password changed successfully",
		data: result,
	});
});

const deleteAccount = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;

	const result = await UserServices.deleteAccount(userId!);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Account deleted successfully",
		data: result,
	});
});

export const UserController = {
	uploadProfileImage,
	updateProfile,
	changePassword,
	deleteAccount,
};
