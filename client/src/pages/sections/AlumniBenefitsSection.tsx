import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export const AlumniBenefitsSection = (): JSX.Element => {
  const benefitsData = [
    {
      title: "Alumni Directory",
      description: (
        <>
          Find and connect with classmates, seniors, juniors, and faculty across
          batches.
          <br />
          Search by{" "}
          <span className="font-bold">
            batch, location, industry, or interests
            <br />
          </span>
          Profiles enriched with{" "}
          <span className="font-bold">LinkedIn integration</span> (education,
          work, skills)
          <br />
          Stay in touch while keeping control with{" "}
          <span className="font-bold">privacy settings</span>
        </>
      ),
      activeIndex: 0,
    },
    {
      title: "Events & Webinars",
      description: (
        <>
          Never miss an opportunity to be part of the TKS family again.
          <br />
          <span className="font-bold">Event calendar</span> with upcoming
          reunions, webinars, and networking sessions
          <br />
          <span className="font-bold">Online RSVP</span> and automated reminders
          <br />
          Track attendance and get event updates instantly
        </>
      ),
      activeIndex: 1,
    },
    {
      title: "Networking & Forums",
      description: (
        <>
          A space to grow professionally and personally, together.
          <br />
          <span className="font-bold">Discussion forums</span> around themes
          like Careers, Mentorship, Higher Studies, Entrepreneurship
          <br />
          Join <span className="font-bold">interest-based groups</span> (e.g.,
          Tech, Arts, Business)
          <br />
          Share posts, ideas, and opportunities with your community
          <br />
          Support current students with{" "}
          <span className="font-bold">guidance and mentorship</span>
        </>
      ),
      activeIndex: 2,
    },
    {
      title: "Messaging",
      description: (
        <>
          Reconnect privately and meaningfully with your peers.
          <br />
          <span className="font-bold">Asynchronous messaging</span> (like email,
          but within the portal)
          <br />
          Reach out directly from{" "}
          <span className="font-bold">
            profile pages
            <br />
          </span>
          No clutter — just focused alumni-to-alumni or student-alumni
          conversations
          <br />
          Ensures privacy, with admin oversight for security
        </>
      ),
      activeIndex: 3,
    },
  ];

  return (
    <section className="w-full flex flex-col gap-[50px]">
      {benefitsData.map((benefit, index) => (
        <Card
          key={index}
          className="w-full border-none shadow-none bg-transparent"
        >
          <CardContent className="flex items-center gap-[55px] p-0">
            <div className="flex flex-col w-[720px] items-start gap-[19px]">
              <h3 className="self-stretch [font-family:'Poppins',Helvetica] font-semibold text-primary-black text-3xl tracking-[0] leading-[normal]">
                {benefit.title}
              </h3>
              <div className="self-stretch [font-family:'Poppins',Helvetica] font-normal text-primary-black text-lg tracking-[0] leading-[30px]">
                <span className="[font-family:'Poppins',Helvetica] font-normal text-[#231f20] text-lg tracking-[0] leading-[30px]">
                  {benefit.description}
                </span>
              </div>
            </div>

            <div className="flex w-[870px] h-[444px] items-center justify-center relative">
              <div className="absolute inset-0 bg-secondary-green rounded-[10px]" />
              <div className="relative [font-family:'Poppins',Helvetica] font-medium text-primary-black text-3xl tracking-[0] leading-[normal] z-10">
                GiF Displaying the respective screen
              </div>
            </div>

            <div className="flex flex-col w-5 items-start gap-[19px]">
              {[0, 1, 2, 3].map((dotIndex) => (
                <div
                  key={dotIndex}
                  className={`w-full h-5 rounded-[10px] ${
                    dotIndex === benefit.activeIndex
                      ? "bg-primary-green-1"
                      : "bg-secondary-green"
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
};
