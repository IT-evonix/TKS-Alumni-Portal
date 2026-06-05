import React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const EventCardSection = (): JSX.Element => {
  const footerLinks = [
    { text: "Terms" },
    { text: "Privacy" },
    { text: "Cookies" },
  ];

  return (
    <section className="relative w-full h-[443px] bg-primary-green-1">
      <div className="flex flex-col items-center justify-center h-full px-4">
        <div className="text-center space-y-6">
          <p className="opacity-60 [font-family:'Poppins',Helvetica] font-normal text-white text-sm tracking-[4.00px] leading-normal">
            UPSKILL FOR A BETTER FUTURE
          </p>

          <h2 className="[font-family:'Abhaya_Libre',Helvetica] font-bold text-white text-[50px] tracking-0 leading-normal whitespace-nowrap">
            Request More Information
          </h2>

          <div className="opacity-80 [font-family:'Poppins',Helvetica] font-normal text-white text-lg tracking-0 leading-[33px]">
            The Kalyani School
            <br />
            Pune, Maharashtra
          </div>

          <Button className="w-[221px] h-[58px] bg-color-1 hover:bg-color-1/90 rounded-[30px] border-0 shadow-[0px_20px_40px_#0000001c] [font-family:'Poppins',Helvetica] font-medium text-white text-base">
            Contact Us
          </Button>
        </div>
      </div>

      <div className="absolute bottom-[82px] left-[7%] right-[7%]">
        <Separator className="bg-white/20 h-px" />
      </div>

      <footer className="absolute bottom-[45px] left-0 right-0 px-[278px]">
        <div className="flex justify-between items-center">
          <div className="[font-family:'Poppins',Helvetica] font-normal text-color-1 text-base tracking-0 leading-normal">
            © 2025 All Rights Reserved
          </div>

          <nav className="flex items-center gap-[37px]">
            {footerLinks.map((link, index) => (
              <a
                key={index}
                href="#"
                className="[font-family:'Poppins',Helvetica] font-normal text-color-1 text-base tracking-0 leading-normal whitespace-nowrap hover:opacity-80 transition-opacity"
              >
                {link.text}
              </a>
            ))}
          </nav>

          <div className="w-[200px] h-[35px]">
            <img
              className="w-full h-full"
              alt="Social media icons"
              src="/figmaAssets/frame-3.svg"
            />
          </div>
        </div>
      </footer>
    </section>
  );
};
