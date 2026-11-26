import bcrypt from "bcryptjs";
import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import { UserStatus } from "../../../generated/prisma/enums";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
	const currentUser = await prisma.user.findUnique({
		where: {
			id: userId,
		},
		select: {
			imagePublicId: true,
			imageUrl: true,
		},
	});

	const cloudinaryResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream(
					{
						resource_type: "auto",
					},

					async (error, result) => {
						if (error) {
							return reject(error);
						}

						if (!result) {
							return reject(new Error("No result returned from Cloudinary"));
						}

						resolve(result);
					},
				)
				.end(buffer);
		},
	);

	const updatedUser = await prisma.user.update({
		where: {
			id: userId,
		},

		data: {
			imageUrl: cloudinaryResult.secure_url,
			imagePublicId: cloudinaryResult.public_id,
		},

		omit: {
			password: true,
		},
	});

	if (currentUser?.imagePublicId && currentUser.imageUrl) {
		await cloudinary.uploader.destroy(currentUser.imagePublicId);
	}

	return updatedUser;
};

const updateProfile = async (
	userId: string,
	payload: {
		name?: string;
		email?: string;
		contactNumber?: string;
		address?: string;
	},
) => {
	const currentUser = await prisma.user.findUnique({
		where: { id: userId },
		include: { patient: true, doctor: true },
	});

	if (!currentUser) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	let targetEmail = currentUser.email;
	if (payload.email && payload.email.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
		targetEmail = payload.email.trim().toLowerCase();
		const isEmailTaken = await prisma.user.findFirst({
			where: {
				email: targetEmail,
				NOT: { id: userId },
			},
		});
		if (isEmailTaken) {
			throw new AppError(httpStatus.CONFLICT, "This email is already in use by another account");
		}
	}

	const updatedUser = await prisma.user.update({
		where: { id: userId },
		data: {
			name: payload.name?.trim() || currentUser.name,
			email: targetEmail,
		},
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			imageUrl: true,
			emailVerified: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	if (currentUser.patient) {
		await prisma.patient.update({
			where: { userId },
			data: {
				name: payload.name?.trim() || currentUser.patient.name,
				email: targetEmail,
				contactNumber: payload.contactNumber ?? currentUser.patient.contactNumber,
				address: payload.address ?? currentUser.patient.address,
			},
		});
	}

	if (currentUser.doctor) {
		await prisma.doctor.update({
			where: { userId },
			data: {
				name: payload.name?.trim() || currentUser.doctor.name,
				email: targetEmail,
				contactNumber: payload.contactNumber ?? currentUser.doctor.contactNumber,
				address: payload.address ?? currentUser.doctor.address,
			},
		});
	}

	return updatedUser;
};

const changePassword = async (
	userId: string,
	payload: { oldPassword?: string; newPassword: string },
) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.password && payload.oldPassword) {
		const isMatch = await bcrypt.compare(payload.oldPassword, user.password);
		if (!isMatch) {
			throw new AppError(httpStatus.BAD_REQUEST, "Current password is incorrect");
		}
	}

	const hashedPassword = await bcrypt.hash(payload.newPassword, 8);

	await prisma.user.update({
		where: { id: userId },
		data: {
			password: hashedPassword,
			needPasswordChange: false,
		},
	});

	return { message: "Password updated successfully" };
};

const deleteAccount = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const now = new Date();

	await prisma.user.update({
		where: { id: userId },
		data: {
			isDeleted: true,
			status: UserStatus.DELETED,
			deletedAt: now,
		},
	});

	await prisma.patient.updateMany({
		where: { userId },
		data: {
			isDeleted: true,
			deletedAt: now,
		},
	});

	await prisma.doctor.updateMany({
		where: { userId },
		data: {
			isDeleted: true,
		},
	});

	return { message: "Account deleted successfully" };
};

export const UserServices = {
	uploadProfileImage,
	updateProfile,
	changePassword,
	deleteAccount,
};
