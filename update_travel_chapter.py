import sys

with open('client/src/pages/TravelChapterPage.tsx', 'r') as f:
    content = f.read()

# Insert Sheet imports
content = content.replace(
    "import { useAuth } from '@/contexts/AuthContext';",
    "import { useAuth } from '@/contexts/AuthContext';\nimport {\n  Sheet,\n  SheetContent,\n  SheetDescription,\n  SheetHeader,\n  SheetTitle,\n  SheetTrigger,\n} from \"@/components/ui/sheet\";"
)

# Replace the layout
start_idx = content.find('<AppLayout>')
end_idx = content.rfind('</AppLayout>') + 12

new_layout = """    <AppLayout>
      {/* Container: Full height WhatsApp-style */}
      <div className="max-w-4xl mx-auto h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-[#efeae2] shadow-xl border-x border-gray-200">
        
        {/* Modern WhatsApp-Style Chat Header */}
        <div className="flex items-center px-3 sm:px-4 py-2 sm:py-3 bg-white border-b border-gray-200 shrink-0 z-10 shadow-sm relative">
          <button
            onClick={() => setLocation('/travel-chapters')}
            className="p-2 mr-1 sm:mr-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <Sheet>
            <SheetTrigger asChild>
              <div className="flex flex-1 items-center gap-3 cursor-pointer hover:bg-gray-50 p-1 sm:p-2 rounded-xl transition-colors">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-gray-200 shrink-0">
                  <img
                    src={chapter.cover_image || "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop"}
                    alt={chapter.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                    {chapter.name}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 truncate flex items-center gap-2">
                    <span>{chapter.members?.length || 0} members</span>
                    <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-gray-300"></span>
                    <span className="hidden sm:inline">tap here for group info</span>
                  </p>
                </div>
              </div>
            </SheetTrigger>

            {/* Chapter Details Drawer (Group Info) */}
            <SheetContent className="w-full sm:max-w-md overflow-y-auto custom-scrollbar p-0 border-l-0">
              <SheetHeader className="p-6 bg-gray-50 border-b border-gray-100">
                <SheetTitle className="text-xl">Chapter Info</SheetTitle>
                <SheetDescription className="sr-only">Chapter details and member list</SheetDescription>
              </SheetHeader>
              
              <div className="p-6 space-y-8">
                {/* Cover Image in Sidebar */}
                <div className="aspect-video rounded-xl overflow-hidden relative shadow-sm">
                  <img
                    src={chapter.cover_image || "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop"}
                    alt={chapter.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-4">
                  <h2 className="text-[#008060] font-bold uppercase tracking-wider text-xs">Description</h2>
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                    {chapter.description || f`Welcome to the official travel chapter for {chapter.city}.`}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
                    <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" /> Est. {new Date(chapter.created_at).toLocaleDateString()}</span>
                    <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5" /> {chapter.city} Hub</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-[#008060] font-bold uppercase tracking-wider text-xs">Members ({chapter.members?.length || 0})</h2>
                  <div className="space-y-3">
                    {chapter.members?.length > 0 ? (
                      chapter.members.map((member: any) => (
                        <div key={member.userId} className="flex items-center group">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 overflow-hidden flex-shrink-0 mr-3">
                            {member.profilePicture ? (
                              <img src={member.profilePicture} alt={member.firstName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-emerald-700 font-bold text-sm">
                                {member.firstName?.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-900 truncate">{member.firstName} {member.lastName}</p>
                            <p className="text-xs text-gray-500 truncate">{member.currentRole || 'Alumni'} {member.currentCompany && f`at {member.currentCompany}`}</p>
                          </div>
                          {member.role === 'admin' && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#008060] bg-emerald-50 px-2 py-1 rounded-md ml-2 border border-emerald-100">Host</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No members yet.</p>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 pb-8">
                  {isMember ? (
                    <button
                      onClick={() => leaveMutation.mutate()}
                      className="w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 font-bold py-3 px-4 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Leave Chapter
                    </button>
                  ) : (
                    <button
                      onClick={() => joinMutation.mutate()}
                      disabled={joinMutation.isPending}
                      className="w-full bg-[#008060] text-white hover:bg-[#006b51] shadow-md transition-all font-bold py-3 px-8 rounded-xl flex items-center justify-center"
                    >
                      {joinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Join Chapter'}
                    </button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto px-2 sm:px-6 py-4 custom-scrollbar flex flex-col gap-1.5 sm:gap-2 relative z-0" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/az-subtle.png')", backgroundBlendMode: 'multiply', backgroundColor: '#e5ddd5' }}>
          {!isMember ? (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4 text-[#008060]">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Join to Chat</h3>
              <p className="text-gray-600 mb-6 max-w-md">You must be a member of the {chapter.city} travel chapter to view and participate in the discussion.</p>
              <button
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
                className="bg-[#008060] text-white hover:bg-[#006b51] shadow-lg transition-all font-bold py-3 px-8 rounded-xl"
              >
                {joinMutation.isPending ? "Joining..." : "Join Chapter"}
              </button>
            </div>
          ) : isLoadingMessages ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-70">
              <div className="bg-[#008060]/10 p-4 rounded-full mb-3 shadow-sm bg-white">
                <MessageSquare className="w-8 h-8 text-[#008060]" />
              </div>
              <p className="text-sm text-gray-600 font-medium bg-white/90 px-4 py-2 rounded-lg shadow-sm border border-gray-100">No messages yet.<br/>Start the conversation!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 sm:gap-2 pb-2">
              {messages.filter((msg: any) => !hiddenMessageIds.includes(msg.id)).map((msg: any, idx: number, visibleArray: any[]) => {
                const isMe = msg.user_id === user?.id;
                const isAdmin = (user as any)?.role === "administrator" || user?.is_admin;
                const canEdit = isMe;
                const canDeleteForEveryone = !!(isMe || isAdmin);
                const canDeleteForMe = !isMe;
                const isEditing = editingId === msg.id;

                const showAvatar = !isMe && (idx === 0 || visibleArray[idx - 1].user_id !== msg.user_id);
                
                // Supabase returns UTC without 'Z', append it to parse correctly
                const utcDateString = msg.created_at.endsWith('Z') ? msg.created_at : f"{msg.created_at}Z";
                const formattedTime = new Date(utcDateString).toLocaleTimeString('en-IN', { 
                  timeZone: 'Asia/Kolkata', 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true
                });
                
                return (
                  <div key={msg.id} className={f"flex w-full {isMe ? 'justify-end' : 'justify-start'}"}>
                    <div className={f"flex max-w-[85%] sm:max-w-[75%] gap-2 {isMe ? 'flex-row-reverse' : 'flex-row'}"}>
                      {/* Avatar for others */}
                      {!isMe ? (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-emerald-100 shrink-0 overflow-hidden mt-auto border border-emerald-200">
                          {showAvatar && (
                            msg.user?.profilePicture ? (
                              <img src={msg.user.profilePicture} alt="User" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold text-[10px] sm:text-xs uppercase">
                                {msg.user?.firstName?.charAt(0) || '?'}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="w-2 sm:w-4 shrink-0"></div> // Smaller spacer
                      )}

                      {/* Message Bubble */}
                      <div className="flex flex-col relative group/msg">
                        {!isMe && showAvatar && (
                          <span className="text-[11px] text-gray-500 font-medium ml-1 mb-0.5">{msg.user?.firstName} {msg.user?.lastName}</span>
                        )}

                        {isEditing ? (
                          <div className={f"flex flex-col gap-2 p-2 sm:p-3 shadow-sm w-full min-w-[200px] sm:min-w-[250px] {isMe ? 'bg-[#dcf8c6] border border-[#dcf8c6] rounded-md rounded-tr-none' : 'bg-white border border-gray-200 rounded-md rounded-tl-none'}"}>
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full bg-white/50 border border-gray-200 rounded p-2 text-sm focus:outline-none focus:border-[#008060] resize-none"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-1">
                              <button 
                                onClick={() => setEditingId(null)}
                                className="p-1 sm:p-1.5 text-gray-500 hover:text-gray-700 hover:bg-black/5 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => editMutation.mutate({ msgId: msg.id, content: editText })}
                                disabled={!editText.trim() || editMutation.isPending}
                                className="p-1 sm:p-1.5 text-emerald-700 hover:bg-black/5 rounded disabled:opacity-50"
                              >
                                {editMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative flex items-center group/bubble">
                            {isMe && (
                              <div className="absolute right-full top-0 mr-1 sm:mr-2 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5 sm:gap-1 bg-white border border-gray-100 shadow-sm rounded-md p-1 z-10">
                                {canEdit && (
                                  <button 
                                    onClick={() => { setEditingId(msg.id); setEditText(msg.content); }}
                                    className="p-1 sm:p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                    title="Edit message"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {(canDeleteForEveryone || canDeleteForMe) && (
                                  <button 
                                    onClick={() => setMessageToDelete({ id: msg.id, forEveryone: canDeleteForEveryone })}
                                    className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title={canDeleteForEveryone ? "Delete for everyone" : "Delete for me"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}

                            <div 
                              className={f"px-3 py-1.5 sm:px-4 sm:py-2 text-[14px] sm:text-[15px] leading-relaxed shadow-sm break-words {isMe ? 'bg-[#dcf8c6] text-gray-900 rounded-md rounded-tr-none' : 'bg-white border border-gray-100 text-gray-900 rounded-md rounded-tl-none'}"}
                            >
                              <div className="flex flex-col">
                                <span>{msg.content}</span>
                                <div className={f"flex items-center justify-end gap-1 mt-0.5 {isMe ? 'text-gray-500' : 'text-gray-400'}"}>
                                  {msg.updated_at && msg.updated_at !== msg.created_at && (
                                    <span className="text-[10px] italic">
                                      (edited)
                                    </span>
                                  )}
                                  <span className="text-[10px]">
                                    {formattedTime}
                                  </span>
                                  {isMe && <Check className="w-3 h-3 ml-0.5 text-[#008060]" />}
                                </div>
                              </div>
                            </div>

                            {!isMe && (
                              <div className="absolute left-full top-0 ml-1 sm:ml-2 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5 sm:gap-1 bg-white border border-gray-100 shadow-sm rounded-md p-1 z-10">
                                {canEdit && (
                                  <button 
                                    onClick={() => { setEditingId(msg.id); setEditText(msg.content); }}
                                    className="p-1 sm:p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                    title="Edit message"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {(canDeleteForEveryone || canDeleteForMe) && (
                                  <button 
                                    onClick={() => setMessageToDelete({ id: msg.id, forEveryone: canDeleteForEveryone })}
                                    className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title={canDeleteForEveryone ? "Delete for everyone" : "Delete for me"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input */}
        {isMember && (
          <div className="p-2 sm:p-4 bg-[#f0f2f5] shrink-0 z-10 border-t border-gray-200">
            <form onSubmit={handleSendMessage} className="flex gap-2 w-full">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-white rounded-lg px-4 py-3 sm:py-3.5 text-sm sm:text-base focus:outline-none shadow-sm border border-gray-200 focus:border-transparent focus:ring-2 focus:ring-[#008060]/20 transition-all"
                disabled={sendMessageMutation.isPending}
              />
              <button
                type="submit"
                disabled={!messageText.trim() || sendMessageMutation.isPending}
                className="w-12 h-12 sm:w-14 sm:h-[50px] bg-[#008060] hover:bg-[#006b51] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-all shrink-0 shadow-sm"
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              {messageToDelete?.forEveryone 
                ? "Are you sure you want to delete this message for everyone? This action cannot be undone." 
                : "Delete this message for yourself? It will remain visible to other chapter members."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
              onClick={() => {
                if (messageToDelete) {
                  if (messageToDelete.forEveryone) {
                    deleteMutation.mutate(messageToDelete.id);
                  } else {
                    hideMessageForMe(messageToDelete.id);
                  }
                  setMessageToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>"""

# fix f-strings (JS template literals)
new_layout = new_layout.replace('f`', '`$')
new_layout = new_layout.replace('`$', '`')
new_layout = new_layout.replace('f"', '`$')
new_layout = new_layout.replace('"', '"')
# We need to manually fix the template literals I wrote as f-strings
new_layout = new_layout.replace('{chapter.city}', '${chapter.city}')
new_layout = new_layout.replace('{member.currentCompany}', '${member.currentCompany}')
new_layout = new_layout.replace('{msg.created_at}Z', '${msg.created_at}Z')
new_layout = new_layout.replace('{isMe ? \'justify-end\' : \'justify-start\'}', '${isMe ? \'justify-end\' : \'justify-start\'}')
new_layout = new_layout.replace('{isMe ? \'flex-row-reverse\' : \'flex-row\'}', '${isMe ? \'flex-row-reverse\' : \'flex-row\'}')
new_layout = new_layout.replace("{isMe ? 'bg-[#dcf8c6] border border-[#dcf8c6] rounded-md rounded-tr-none' : 'bg-white border border-gray-200 rounded-md rounded-tl-none'}", "${isMe ? 'bg-[#dcf8c6] border border-[#dcf8c6] rounded-md rounded-tr-none' : 'bg-white border border-gray-200 rounded-md rounded-tl-none'}")
new_layout = new_layout.replace("{isMe ? 'bg-[#dcf8c6] text-gray-900 rounded-md rounded-tr-none' : 'bg-white border border-gray-100 text-gray-900 rounded-md rounded-tl-none'}", "${isMe ? 'bg-[#dcf8c6] text-gray-900 rounded-md rounded-tr-none' : 'bg-white border border-gray-100 text-gray-900 rounded-md rounded-tl-none'}")
new_layout = new_layout.replace("{isMe ? 'text-gray-500' : 'text-gray-400'}", "${isMe ? 'text-gray-500' : 'text-gray-400'}")

content = content[:start_idx] + new_layout + content[end_idx:]

with open('client/src/pages/TravelChapterPage.tsx', 'w') as f:
    f.write(content)

print("Updated file successfully")
