import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const AlumniCommunitySection = (): JSX.Element => {
  return (
    <Card className="w-full bg-primary-white rounded-[20px] border-2 border-solid border-[#008060]">
      <CardContent className="flex p-5 gap-[30px]">
        <img
          className="w-[550px] h-[345px] rounded-[20px] object-cover flex-shrink-0"
          alt="Rectangle"
          src="/figmaAssets/rectangle-10.png"
        />

        <div className="flex flex-col justify-center flex-1 max-w-[726px]">
          <div className="[font-family:'Poppins',Helvetica] font-semibold text-primary-green-1 text-3xl tracking-[0] leading-[normal] mb-2">
            Annual Alumni Meet 2025
          </div>

          <div className="[font-family:'Poppins',Helvetica] font-medium text-primary-black text-lg tracking-[0] leading-[30px] mb-[30px]">
            Reconnect with old friends, share memories, and celebrate the TKS
            journey together. An evening filled with nostalgia, laughter, and
            networking.
          </div>

          <div className="[font-family:'Poppins',Helvetica] font-semibold text-primary-black text-lg tracking-[0] leading-[30px] whitespace-nowrap">
            Date: March 2025
          </div>
        </div>

        <div className="flex flex-col justify-center gap-2.5 flex-shrink-0">
          <Button className="w-[200px] h-[50px] bg-primary-black text-primary-white rounded-[10px] [font-family:'Poppins',Helvetica] font-medium text-xl tracking-[0] leading-[30px] h-auto">
            Register / Login
          </Button>

          <div className="w-[204px] [font-family:'Poppins',Helvetica] font-normal text-primary-black text-base tracking-[0] leading-[30px] underline whitespace-nowrap text-center">
            Click above to register or sign in
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
