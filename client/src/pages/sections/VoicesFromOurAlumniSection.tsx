import React from "react";

export const VoicesFromOurAlumniSection = (): JSX.Element => {
  return (
    <section className="flex flex-col w-full items-center justify-center gap-[89px] py-8">
      <img
        className="w-[400px] h-[304.35px]"
        alt="Group"
        src="/figmaAssets/group-20.png"
      />

      <div className="w-full [font-family:'Inter',Helvetica] font-normal text-transparent text-[32px] text-center tracking-[0] leading-[normal]">
        <span className="font-bold text-[#a6ce39]">STAY UPDATED</span>

        <span className="[font-family:'Poppins',Helvetica] text-black text-2xl">
          {" "}
          with reunions, webinars, and school events
        </span>
      </div>
    </section>
  );
};
