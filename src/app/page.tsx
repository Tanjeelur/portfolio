import Nav from "@/components/Nav";
import SmoothScroll from "@/components/SmoothScroll";
import BackgroundCanvas from "@/components/three/BackgroundCanvas";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Experience from "@/components/sections/Experience";
import Projects from "@/components/sections/Projects";
import Demos from "@/components/sections/Demos";
import Research from "@/components/sections/Research";
import Skills from "@/components/sections/Skills";
import Contact from "@/components/sections/Contact";
import BootScreen from "@/components/fx/BootScreen";
import Cursor from "@/components/fx/Cursor";

export default function Home() {
  return (
    <>
      <BootScreen />
      <Cursor />
      <SmoothScroll />
      <BackgroundCanvas />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <About />
        <Experience />
        <Projects />
        <Demos />
        <Research />
        <Skills />
        <Contact />
      </main>
    </>
  );
}
