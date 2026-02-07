import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Check, X, Music, Mic, Disc, Calendar, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

// --- Utility Components ---

const Button = ({ children, variant = "primary", className = "", ...props }) => {
  const baseStyles = "px-8 py-4 font-bold uppercase tracking-wider transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 border-2";

  const variants = {
    primary: "bg-[#8B1E1E] text-[#F9F5EB] border-[#8B1E1E] hover:bg-[#681212] hover:border-[#681212] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.8)]",
    secondary: "bg-transparent text-[#2D241E] border-[#2D241E] hover:bg-[#2D241E] hover:text-[#F9F5EB] shadow-[4px_4px_0px_0px_rgba(139,30,30,0.3)]"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Section = ({ children, className = "", id = "" }) => (
  <section id={id} className={`relative py-16 md:py-24 px-6 md:px-12 ${className}`}>
    <div className="max-w-7xl mx-auto relative z-10">
      {children}
    </div>
  </section>
);

const FadeIn = ({ children, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => setIsVisible(entry.isIntersecting));
    });
    const currentRef = domRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => currentRef && observer.unobserve(currentRef);
  }, []);

  return (
    <div
      ref={domRef}
      className={`transition-all duration-1000 transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// --- Audio Player Component ---
const AudioPlayer = ({ label, isDemo = false, playerId, currentlyPlaying, onPlay, audioSrc, track }) => {
  const audioRef = useRef(null);
  const hasTrackedRef = useRef(false);
  const isPlaying = currentlyPlaying === playerId;

  // Control playback based on currentlyPlaying state
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      // Track play event once per play session
      if (!hasTrackedRef.current && typeof window !== 'undefined' && window.fathom) {
        window.fathom.trackEvent(`Play: ${track}`);
        hasTrackedRef.current = true;
      }
      audioRef.current.play();
    } else {
      hasTrackedRef.current = false;
      audioRef.current.pause();
    }
  }, [isPlaying, track]);

  const handlePlay = () => {
    if (isPlaying) {
      onPlay(null); // Pause this player
    } else {
      onPlay(playerId); // Start this player (and pause others)
    }
  };

  return (
    <div className={`p-6 border-2 border-[#2D241E] ${isDemo ? 'bg-[#f7f3e7]' : 'bg-[#ffdf97]'} transition-all`}>
      <audio ref={audioRef} src={audioSrc} preload="metadata" loop />
      <div className={`text-xs font-mono uppercase tracking-widest mb-3 opacity-60`}>{label}</div>
      <button
        onClick={handlePlay}
        className={`w-full py-3 font-mono uppercase font-bold tracking-widest border-2 border-[#2D241E] bg-transparent hover:bg-[#2D241E] hover:text-[#F9F5EB] transition-colors flex items-center justify-center gap-2`}
      >
        {isPlaying ? <><Pause size={16} /> Stop</> : <><Play size={16} /> Play</>}
      </button>
    </div>
  );
};

// --- Contact Form Component ---
const ContactForm = ({ onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    musicLink: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('https://formspree.io/f/mbdlpyno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setIsSuccess(true);
        setFormData({ name: '', email: '', musicLink: '', message: '' });
      } else {
        throw new Error('Form submission failed');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      alert('There was an error submitting the form. Please try again or email me directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        onCancel();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onCancel]);

  if (isSuccess) {
    return (
      <div className="py-12 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-[#8B1E1E] rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={32} className="text-[#F9F5EB]" />
        </div>
        <p className="text-xl font-serif text-[#2D241E] mb-2">Thanks! I've got your message.</p>
        <p className="text-[#2D241E]/80">I'll take a listen to your links and get back to you within 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-lg mb-8 text-[#2D241E]/80 text-center">Tell me a bit about your project, and let's see if we're a good fit.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block font-mono text-sm uppercase tracking-wider mb-2 text-[#2D241E]">
            Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-3 border-2 border-[#2D241E] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1E1E] font-sans"
          />
        </div>

        <div>
          <label htmlFor="email" className="block font-mono text-sm uppercase tracking-wider mb-2 text-[#2D241E]">
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 border-2 border-[#2D241E] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1E1E] font-sans"
          />
        </div>

        <div>
          <label htmlFor="musicLink" className="block font-mono text-sm uppercase tracking-wider mb-2 text-[#2D241E]">
            Link to Your Music
          </label>
          <input
            type="text"
            id="musicLink"
            name="musicLink"
            value={formData.musicLink}
            onChange={handleChange}
            placeholder="Streaming, rough demo or social media link."
            className="w-full px-4 py-3 border-2 border-[#2D241E] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1E1E] font-sans placeholder:text-[#2D241E]/40"
          />
        </div>

        <div>
          <label htmlFor="message" className="block font-mono text-sm uppercase tracking-wider mb-2 text-[#2D241E]">
            What are you looking to create?
          </label>
          <textarea
            id="message"
            name="message"
            rows="5"
            value={formData.message}
            onChange={handleChange}
            className="w-full px-4 py-3 border-2 border-[#2D241E] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1E1E] font-sans resize-none"
          />
        </div>

        <div className="flex gap-4">
          <Button type="submit" variant="primary" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? 'Sending...' : 'Submit'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

// --- Main Application ---

// Artist examples data - add all 5 here
const allArtistExamples = [
  {
    id: 'angela-rose',
    name: 'Angela Rose',
    track: 'Nepotism Baby',
    image: '/angela-rose.jpg',
    description: "We took an acoustic sketch and transformed it into an expansive bedroom-pop anthem, swapping chilled guitars for high-energy strumming and layering synth-bass with roomy drums.",
    quote: "Thank you so much Pete for your work on this, I really love what has been created so much.",
    testimonialImage: '/testimonial-angela-rose.jpg',
    demoAudio: '/nepo-demo.mp3',
    finalAudio: '/nepo-master.mp3',
    isPlaceholder: false
  },
  {
    id: 'pinky-ring',
    name: 'Pinky Ring',
    track: '5 Minutes',
    image: '/pinky-ring.png',
    description: 'Working around existing studio takes, I built a full-band arrangement, including live drums and Mellotron, captured entirely live to preserve the natural timing and breath of the original performance.',
    quote: '[Testimonial quote]',
    attribution: 'Sam V (Pinky Ring)',
    testimonialImage: '/testimonial-pinky-ring.jpg',
    demoAudio: '/5-minutes-demo.mp3',
    finalAudio: '/5-minutes-master.mp3',
    isPlaceholder: false
  },
  {
    id: 'pixie',
    name: 'Pixie',
    track: 'Mr Moonlight',
    image: '/pixie.jpg',
    description: 'To highlight a powerful vocal, we replaced standard strumming with a custom open-tuning fingerstyle part and a dynamic, breathing rhythm section.',
    quote: '[Testimonial quote]',
    testimonialImage: '/testimonial-pixie.jpg',
    demoAudio: '/mr-moonlight-demo.mp3',
    finalAudio: '/mr-moonlight-master.mp3',
    isPlaceholder: false
  },
  {
    id: 'trouble-tones',
    name: 'Trouble Tones',
    track: 'Breathe',
    image: '/david-t.jpg',
    description: "By layering remote session players and authentic textures like dulcimer and organ, we transformed a raw folk demo into a cinematic soul record.",
    quote: "I couldn't be more happier with how it turned out and I'm so grateful you've helped me bring my little song Breathe to life.",
    attribution: 'David T (Trouble Tones)',
    testimonialImage: '/testimonial-david-t.jpg',
    demoAudio: '/breathe-demo.mp3',
    finalAudio: '/breathe-master.mp3',
    isPlaceholder: false
  },
  {
    id: 'jorja-medaris',
    name: 'Jorja Medaris',
    track: 'Idea of You',
    image: '/jorja-m.jpg',
    description: 'We transformed a standard acoustic demo into an ethereal post-R&B ballad, replacing guitar with piano and using reversed vocal samples to create a haunting, immersive atmosphere.',
    quote: '[Testimonial quote]',
    attribution: 'Jorja M',
    testimonialImage: '/testimonial-jorja-m.jpg',
    demoAudio: '/idea-of-you-demo.mp3',
    finalAudio: '/idea-of-you-master.mp3',
    isPlaceholder: false
  },
];

export default function App() {
  const [scrolled, setScrolled] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [selectedExamples, setSelectedExamples] = useState([]);
  const [showContactForm, setShowContactForm] = useState(false);

  // Randomly select 3 examples on mount (or manually set for A/B testing)
  useEffect(() => {
    // OPTION 1: Random selection (uncomment to use)
    const shuffled = [...allArtistExamples].sort(() => 0.5 - Math.random());
    setSelectedExamples(shuffled.slice(0, 3));

    // OPTION 2: Manual selection for A/B testing (comment out random selection above and uncomment one below)
    // setSelectedExamples([allArtistExamples[0], allArtistExamples[1], allArtistExamples[2]]); // Test combo A
    // setSelectedExamples([allArtistExamples[0], allArtistExamples[2], allArtistExamples[4]]); // Test combo B
  }, []);

  // Load Senja widget scripts
  useEffect(() => {
    const script1 = document.createElement('script');
    script1.src = 'https://widget.senja.io/widget/82b3bfc7-75b1-4612-822d-4a301e138c82/platform.js';
    script1.async = true;
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://widget.senja.io/widget/153f45d6-2554-47ef-a1e8-d99435d47571/platform.js';
    script2.async = true;
    document.body.appendChild(script2);

    return () => {
      document.body.removeChild(script1);
      document.body.removeChild(script2);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToContact = () => {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F9F5EB] text-[#2D241E] font-sans selection:bg-[#8B1E1E] selection:text-[#F9F5EB] overflow-x-hidden">

      {/* Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-40 mix-blend-multiply z-50"
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E")` }}>
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${scrolled ? 'bg-[#F9F5EB]/90 backdrop-blur-md border-b-2 border-[#2D241E]/10 py-3' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-3">
            <img
              src="/mpc-icon.png"
              alt="MPC"
              className="h-10 md:h-14"
            />
            <img
              src="/logo.png"
              alt="Pete Covington"
              className="h-10 md:h-14"
            />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 md:pt-48 md:pb-40 px-6 bg-[#F5F0E1]">
         <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#8B1E1E] opacity-10 blur-3xl"></div>

         <div className="max-w-5xl mx-auto relative z-10">
          <FadeIn>
            <h1 className="text-3xl md:text-6xl lg:text-7xl font-serif font-black text-[#2D241E] leading-[0.95] mb-4 md:mb-8 tracking-tight">
              Turn Your Demos into <br/><span className="text-[#8B1E1E]">Timeless Records</span>.
            </h1>
            <p className="text-base md:text-xl font-serif text-[#2D241E]/60 max-w-2xl mb-12 leading-snug md:leading-relaxed md:ml-2">
              Collaborative production for artists who want <br className="md:hidden"/>to capture their authentic sound without compromising on quality.
            </p>

            {/* Studio Image */}
            <div className="w-full mb-8 overflow-hidden rounded-lg border-2 border-[#2D241E]/20">
              <img
                src="/studio-hero.png"
                alt="Pete Covington's studio workspace with mixing desk and monitors"
                className="w-full h-auto object-cover"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button variant="primary" onClick={() => { window.fathom?.trackEvent('Click: Email Form'); scrollToContact(); setShowContactForm(true); }}>Email About Your Project</Button>
            </div>
          </FadeIn>
        </div>
      </header>

      {/* Proof Section - Demo vs Production */}
      <Section className="bg-[#F9F5EB]">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-3xl md:text-6xl font-serif font-bold text-[#2D241E] mb-2 md:mb-4">From Demo to Final Master</h2>
          <p className="font-serif text-base md:text-xl text-[#2D241E]/60">Hear how a rough idea transforms through the production process.</p>
        </div>

        <FadeIn>
          <div className="max-w-7xl mx-auto space-y-10 md:space-y-16">
            {selectedExamples.map((example, index) => {
              const playersSection = (
                <div className="bg-[#F9F5EB] p-8 border-2 border-[#2D241E] shadow-lg h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <img src={example.image} alt={example.name} className="w-12 h-12 rounded-full object-cover border-2 border-[#2D241E]/30" />
                    <h3 className="text-2xl font-serif font-bold">{example.name} - "{example.track}"</h3>
                  </div>
                  <p className="text-sm font-mono mb-6 text-[#2D241E]/60">
                    {example.description}
                  </p>
                  <div className="grid md:grid-cols-2 gap-6">
                    <AudioPlayer label="The Demo" isDemo={true} playerId={`${example.id}-demo`} currentlyPlaying={currentlyPlaying} onPlay={setCurrentlyPlaying} audioSrc={example.demoAudio} track={example.track} />
                    <AudioPlayer label="The Produced Record" isDemo={false} playerId={`${example.id}-final`} currentlyPlaying={currentlyPlaying} onPlay={setCurrentlyPlaying} audioSrc={example.finalAudio} track={example.track} />
                  </div>
                </div>
              );

              const testimonialSection = (
                <div className="bg-[#F9F5EB] p-8 border-2 border-[#2D241E] shadow-lg h-full flex flex-col justify-center">
                  <div className="w-full">
                    {example.testimonialImage ? (
                      <>
                        <img
                          src={example.testimonialImage}
                          alt={`Testimonial from ${example.name}`}
                          className="w-full rounded border border-[#2D241E]/10 shadow-sm mb-3"
                        />
                        <p className="font-mono text-sm uppercase tracking-wider text-[#2D241E]/60 text-right">- {example.attribution || example.name}</p>
                      </>
                    ) : (
                      <>
                        <p className="italic text-lg leading-relaxed mb-2">
                          "{example.quote}"
                        </p>
                        <p className="font-mono text-sm uppercase tracking-wider text-[#2D241E]/60 text-right">- {example.attribution || example.name}</p>
                      </>
                    )}
                  </div>
                </div>
              );

              return (
                <div key={example.id} className="grid md:grid-cols-3 gap-8">
                  <div className="md:col-span-2">{playersSection}</div>
                  <div className="md:col-span-1">{testimonialSection}</div>
                </div>
              );
            })}
          </div>
        </FadeIn>
      </Section>

      {/* Artist Testimonial Section */}
      <Section className="bg-[#F5F0E1] !pb-20 md:!pb-24">
        <div className="text-center mb-12 md:mb-20">
          <h2 className="text-3xl md:text-6xl font-serif font-bold text-[#2D241E] mb-2 md:mb-4">Artist Testimonial</h2>
        </div>
        <FadeIn>
          <div className="max-w-2xl mx-auto">
            <div className="senja-embed" data-id="153f45d6-2554-47ef-a1e8-d99435d47571" data-mode="shadow" data-lazyload="false" style={{ display: 'block', width: '100%' }}></div>
          </div>
        </FadeIn>
      </Section>

      {/* Process Section - Zig Zag Layout */}
      <Section className="bg-[#F9F5EB]">
        <div className="text-center mb-12 md:mb-20">
          <h2 className="text-3xl md:text-6xl font-serif font-bold text-[#2D241E] mb-4">My Working Process</h2>
        </div>

        {/* Phase 1 - Image Left, Text Right */}
        <FadeIn>
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16 md:mb-32">
            <div className="order-2 md:order-1">
              <div className="aspect-square overflow-hidden rounded-lg border-2 border-[#2D241E]/20">
                <img
                  src="/phase1.png"
                  alt="Pete listening and working at the mixing desk"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h3 className="text-2xl md:text-4xl font-serif font-bold mb-2 md:mb-4">Phase 1: Vision & Pre-Production</h3>
              <p className="text-base md:text-xl mb-4 md:mb-6 text-[#8B1E1E]">Honoring the song before we hit record.</p>
              <p className="font-serif text-base md:text-lg leading-relaxed">
                Every project starts with a deep dive into your influences, references, and demos. We'll look at the arrangement and structure together to ensure the production <strong>fully supports your songwriting and vision.</strong> This phase is about making sure the foundation is rock-solid, allowing us to be more creative and experimental once we move into the full production.
              </p>
            </div>
          </div>
        </FadeIn>

        {/* Phase 2 - Text Left, Image Right */}
        <FadeIn delay={100}>
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16 md:mb-32">
            <div>
              <h3 className="text-2xl md:text-4xl font-serif font-bold mb-2 md:mb-4">Phase 2: Performance & Production</h3>
              <p className="text-base md:text-xl mb-4 md:mb-6 text-[#8B1E1E]">Building the sonic world, whether in-person or remote.</p>
              <p className="font-serif text-base md:text-lg leading-relaxed mb-4">
                This is where your songs develop their character. We'll thoughtfully layer instruments and textures that complement your sound, using my network of world-class session musicians to capture authentic, human performances.
              </p>
              <p className="font-serif text-base md:text-lg leading-relaxed">
                Whether we're tracking live in the studio or working entirely remotely, I'll guide you through the process in real-time via video call so it feels like we're in the same room. I maintain a comfortable, creative environment where your best performances can emerge naturally, with regular opportunities for feedback as the tracks evolve.
              </p>
            </div>
            <div>
              <div className="aspect-square overflow-hidden rounded-lg border-2 border-[#2D241E]/20">
                <img
                  src="/phase2.png"
                  alt="Pete collaborating with an artist in the studio"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Phase 3 - Image Left, Text Right */}
        <FadeIn delay={200}>
          <div className="grid md:grid-cols-2 gap-12 items-center mb-12 md:mb-20">
            <div className="order-2 md:order-1">
              <div className="aspect-square overflow-hidden rounded-lg border-2 border-[#2D241E]/20">
                <img
                  src="/phase3.png"
                  alt="Close-up of DAW session and mixing process"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h3 className="text-2xl md:text-4xl font-serif font-bold mb-2 md:mb-4">Phase 3: Mixing and Delivery</h3>
              <p className="text-base md:text-xl mb-4 md:mb-6 text-[#8B1E1E]">Refinement and getting your music ready for the world.</p>
              <p className="font-serif text-base md:text-lg leading-relaxed mb-4">
                Once we've captured the performances, I move into the mix - carving out space for every element to maximize clarity and impact while staying aligned with our original vision. We'll refine the details through revision rounds until we're both confident the song is ready for release.
              </p>
              <p className="font-serif text-base md:text-lg leading-relaxed">
                You'll receive industry-standard masters optimized for all platforms, along with all the files (stems) you need for future performances or remixes. More importantly, you'll have a record that authentically represents you as an artist.
              </p>
            </div>
          </div>
        </FadeIn>

        {/* Closing Note */}
        <FadeIn delay={300}>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-base md:text-xl text-[#2D241E]/80 mb-8">
              Every project is unique. Whether you're creating your first release or adding to an established catalog, I adapt this framework to suit your specific needs - keeping your artistic voice at the center of everything we create.
            </p>
            <div className="bg-[#D69E2E]/20 px-6 py-4 border-2 border-[#D69E2E]">
              <p className="font-mono text-sm">
                <img src="/skateboard-icon.png" alt="" className="inline-block w-5 h-5 align-middle mr-2" />
                <strong>Working Together, Anywhere</strong> I'm based in Sydney, Australia, but I work with artists globally. We use high-res audio streaming so you can hear what I hear in real-time, making remote collaboration feel seamless.
              </p>
            </div>
          </div>
        </FadeIn>
      </Section>

      {/* Testimonials Section */}
      <Section className="bg-[#2D241E] text-[#F9F5EB]">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-3xl md:text-6xl font-serif font-bold text-[#D69E2E]">What Artists Say</h2>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="senja-embed" data-id="82b3bfc7-75b1-4612-822d-4a301e138c82" data-mode="shadow" data-lazyload="false" style={{ display: 'block', width: '100%' }}></div>
        </div>
      </Section>

      {/* Listen Section - Spotify Embed */}
      <Section className="bg-[#F9F5EB]">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-[#2D241E] mb-2 md:mb-4">Want to Hear More?</h2>
          <p className="font-serif text-base md:text-xl text-[#2D241E]/60">Check out my selected discography.</p>
        </div>

        <FadeIn>
          <div className="max-w-4xl mx-auto">
            <div className="w-full border-2 border-[#2D241E]/20 overflow-hidden rounded-lg">
              <iframe
                style={{ borderRadius: '12px' }}
                src="https://open.spotify.com/embed/playlist/6WfTR6zdI7Z0mUzL2ycqiF?utm_source=generator"
                width="100%"
                height="380"
                frameBorder="0"
                allowFullScreen=""
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              ></iframe>
            </div>
          </div>
        </FadeIn>
      </Section>

      {/* CTA Section */}
      <section id="contact" className="py-20 md:py-32 px-6 bg-[#F5F0E1] text-center relative overflow-hidden">
         <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: `radial-gradient(#D69E2E 1px, transparent 1px)`, backgroundSize: '30px 30px' }}></div>

         <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-7xl font-serif font-black text-[#2D241E] mb-3 md:mb-6">Ready to Start<br/>Your Project?</h2>


            {!showContactForm ? (
              <>
                <div className="flex flex-col items-center gap-4 mb-8 md:mb-12">
                  <Button variant="primary" className="text-xl px-12 py-6" onClick={() => { window.fathom?.trackEvent('Click: Email Form'); setShowContactForm(true); }}>Email Me About Your Project</Button>
                </div>

                <p className="font-mono text-xs opacity-60 uppercase tracking-widest">
                    You'll hear back from me within 24 hours.
                </p>
              </>
            ) : (
              <ContactForm onCancel={() => setShowContactForm(false)} />
            )}
         </div>
      </section>

      {/* Footer with Substack */}
      <footer className="bg-[#2D241E] text-[#F9F5EB] py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="border-t border-[#F9F5EB]/20 pt-8 pb-8 text-center">
            <p className="font-serif text-lg mb-3">Not ready to record yet?</p>
            <p className="font-mono text-sm mb-6 opacity-80 max-w-2xl mx-auto">Visit my Substack for a look inside my sessions, songwriting breakthroughs, <br/>and ideas to help your creative process.</p>
            <button onClick={() => window.open('https://petecovington.substack.com/', '_blank')} className="px-6 py-3 font-mono text-sm uppercase tracking-wider border-2 border-[#F9F5EB] text-[#F9F5EB] hover:bg-[#F9F5EB] hover:text-[#2D241E] transition-all duration-300">
              Substack
            </button>
          </div>
          <div className="text-center pt-8 border-t border-[#F9F5EB]/20">
            <p className="font-mono text-xs opacity-40 uppercase tracking-widest">&copy; {new Date().getFullYear()} Pete Covington</p>
            <p className="font-mono text-xs opacity-40 mt-2">
              <a href="mailto:hello@petecovington.com" className="hover:opacity-100 transition-opacity">hello@petecovington.com</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
