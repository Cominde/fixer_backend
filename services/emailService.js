// services/emailService.js
const nodemailer = require("nodemailer");
const car = require("../models/Car");
// Function to send email to car owner with generated code and password
exports.sendCarCredentials = async (options) => {
  // Replace placeholders with your actual email sending logic
  try {
    const transporter = nodemailer.createTransport({
      // SMTP configuration
    });

    const mailOptions = {
      from: "your_email@example.com",
      to: options.email,
      subject: "Welcome to Car Service Center!",
      text: `Dear ${options.ownerName},\n\nYour car has been successfully registered with us.\n\nHere are your credentials:\nCode: ${options.generatedCode}\nPassword: ${options.generatedPassword}\n\nThank you for choosing our service.\n\nBest regards,\nThe Car Service Center Team`,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw error;
  }
};

// Function to send email with password reset instructions
exports.sendPasswordResetEmail = async (car) => {
  // Replace placeholders with your actual email sending logic
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT, // if secure false port = 587, if true port= 465
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: "joeshwoa@gmail.com",
      to: car.email,
      subject: "Password Reset Instructions",
      text: `Dear ${car.ownerName},\n\nYou have requested to reset your password for your car service center account.\n\nYour password is: ${car.generatedPassword}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nThe Car Service Center Team`,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw error;
  }
};

// Function to send email to notify repair completion
exports.sendRepairCompletionEmail = async (car) => {
  // Replace placeholders with your actual email sending logic
  try {
    const transporter = nodemailer.createTransport({
      // SMTP configuration
    });

    const mailOptions = {
      from: "your_email@example.com",
      to: car.email,
      subject: "Car Repair Completion",
      text: `Dear ${car.ownerName},\n\nWe're pleased to inform you that the repair for your car has been completed.\n\nThank you for choosing our service.\n\nBest regards,\nThe Car Service Center Team`,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw error;
  }
};
