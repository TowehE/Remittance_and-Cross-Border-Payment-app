import nodemailer from 'nodemailer';

interface email_options {
  to: string;
  subject: string;
  html: string;
}


export const send_email = async (email: email_options) => {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth:{
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD

        }
    })

await transporter.sendMail({
    from: `"Remittance App" <${process.env.EMAIL_USER}>`,
    to: email.to,
    subject: email.subject,
    html: email.html,
})
}