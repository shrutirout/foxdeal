import { NextResponse } from "next/server";
import { sendPriceDropAlert } from "@/lib/email";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Please provide email parameter: ?email=your@email.com" },
        { status: 400 }
      );
    }

    const fakeProduct = {
      name: "Test Product - Puma Running Shoes",
      url: "https://www.flipkart.com/test",
      currency: "INR",
      image_url: "https://rukminim2.flixcart.com/image/612/612/xif0q/shoe/7/z/r/8-1011b046-020-asics-black-white-original-imagg7wzhn9g6tec.jpeg",
    };

    const oldPrice = 3999;
    const newPrice = 2499;

    console.log(`Sending test email to: ${email}`);

    const result = await sendPriceDropAlert(email, fakeProduct, oldPrice, newPrice);

    if (result.error) {
      console.error("Email send failed:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: "Failed to send email. Check your RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local",
        },
        { status: 500 }
      );
    }

    console.log("Test email sent successfully");

    return NextResponse.json({
      success: true,
      message: `Test price drop email sent to ${email}`,
      emailData: result.data,
      productDetails: {
        name: fakeProduct.name,
        oldPrice: `₹${oldPrice}`,
        newPrice: `₹${newPrice}`,
        savings: `₹${oldPrice - newPrice} (${(((oldPrice - newPrice) / oldPrice) * 100).toFixed(1)}%)`,
      },
    });
  } catch (error) {
    console.error("Test email error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
