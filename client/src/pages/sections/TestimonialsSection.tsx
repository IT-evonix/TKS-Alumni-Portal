
import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export const TestimonialsSection = (): JSX.Element => {
  return (
    <div className="flex justify-center w-full">
      <div className="relative w-full max-w-[1170px] h-auto bg-[#008060] rounded-[20px] overflow-hidden">
        {/* Background Ornaments */}
        <div className="absolute inset-0 overflow-hidden">
          <img src="/figmaAssets/ornament-68.svg" alt="" className="absolute top-[88px] left-[103px] w-[38px] h-[68px]" />
          <img src="/figmaAssets/ornament-69.svg" alt="" className="absolute top-[486px] right-[103px] w-11 h-[78px]" />
          <img src="/figmaAssets/ornament-67.svg" alt="" className="absolute top-[121px] left-[150px] w-[38px] h-[69px]" />
          <img src="/figmaAssets/ornament-2.svg" alt="" className="absolute top-[408px] left-[188px] w-[141px] h-[155px]" />
          <img src="/figmaAssets/ornament-2.svg" alt="" className="absolute top-[81px] right-[188px] w-[141px] h-[154px]" />
          <img src="/figmaAssets/vector-1.svg" alt="" className="absolute top-1/3 left-[16%] w-6 h-12" />
          <img src="/figmaAssets/vector.svg" alt="" className="absolute top-1/3 right-[16%] w-6 h-12" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center py-16 px-8">
          {/* Testimonial Card */}
          <Card className="w-full max-w-[633px] bg-[#a6ce39] rounded-xl border-0 mb-8">
            <CardContent className="p-8 text-center space-y-6">
              <h3 className="font-['Inter'] font-bold text-white text-2xl">
                It was a very good experience
              </h3>
              <p className="font-['Poppins'] font-normal text-white text-lg leading-relaxed">
                "The Alumni Portal has been a game-changer for me. I reconnected with classmates I
                hadn't spoken to in years, and through the directory I even found a senior working in the
                same industry. We've collaborated on projects since then, and I wouldn't have had that
                opportunity without this platform. It truly feels like the TKS family is just a click away."
              </p>
            </CardContent>
          </Card>

          {/* Profile Image */}
          <div className="mb-4">
            <img
              src="/figmaAssets/group-5.png"
              alt="Rohit Mehra"
              className="w-[100px] h-[100px] rounded-full object-cover mx-auto"
              loading="lazy"
            />
          </div>

          {/* Profile Info */}
          <div className="text-center text-white">
            <h4 className="font-['Poppins'] font-semibold text-2xl mb-1">
              Rohit Mehra
            </h4>
            <p className="font-['Poppins'] font-medium text-base">
              Class of 2014
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
