import React from "react";

export const AlumniPortalSection = (): JSX.Element => {
  return (
    <section className="flex items-center justify-center gap-8 w-full py-8">
      <div className="flex-shrink-0">
        <img
          className="w-[365.06px] h-[365.71px]"
          alt="Illustration"
          src="/figmaAssets/illustration.png"
        />
      </div>

      <div className="flex-1 max-w-md">
        <h2 className="[font-family:'Inter',Helvetica] font-normal text-[32px] text-center leading-normal">
          <span className="font-bold text-[#fdb913]">CONNECT</span>
          <span className="[font-family:'Poppins',Helvetica] text-black text-2xl">
            {" "}
            with classmates and faculty across the globe
          </span>
        </h2>
      </div>
    </section>
  );
};
